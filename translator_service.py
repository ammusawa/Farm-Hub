from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, BitsAndBytesConfig
import torch
import torch.quantization
import sys
import re
import threading
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js

# Cache models to avoid reloading them every timez
_tokenizer = None
_model = None
_device = None
_model_lock = threading.Lock()  # Lock to prevent concurrent model access

# Language codes for NLLB model (very important!)
LANG_CODES = {
    "en": "eng_Latn",   # English
    "ha": "hau_Latn",   # Hausa
    "ig": "ibo_Latn",   # Igbo
    "yo": "yor_Latn",   # Yoruba
}

def load_model():
    """Load and cache the NLLB model with aggressive optimizations for maximum speed"""
    global _tokenizer, _model, _device
    
    if _tokenizer is not None and _model is not None:
        return _tokenizer, _model, _device
    
    model_name = "facebook/nllb-200-distilled-600M"
    print(f"Loading NLLB model: {model_name}...", file=sys.stderr)
    
    # Use GPU if available, otherwise CPU
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {_device}", file=sys.stderr)
    
    try:
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Load model with optimizations based on device
        if _device.type == "cpu":
            print("Loading model for CPU with quantization...", file=sys.stderr)
            _model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                torch_dtype=torch.float32
            )
            _model = _model.to(_device)
            _model.eval()
            
            # Apply dynamic quantization for faster CPU inference (2-4x speedup)
            print("Applying dynamic 8-bit quantization for faster CPU inference...", file=sys.stderr)
            try:
                _model = torch.quantization.quantize_dynamic(
                    _model,
                    {torch.nn.Linear},  # Quantize linear layers
                    dtype=torch.qint8
                )
                print("✓ 8-bit quantization applied successfully!", file=sys.stderr)
            except Exception as e:
                print(f"⚠ Quantization not available: {e}, continuing with standard precision...", file=sys.stderr)
        else:
            # GPU: Use 8-bit quantization or half precision
            print("Loading model for GPU with optimizations...", file=sys.stderr)
            try:
                # Try 8-bit quantization first (fastest, lowest memory)
                quantization_config = BitsAndBytesConfig(
                    load_in_8bit=True,
                    llm_int8_threshold=6.0
                )
                _model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    quantization_config=quantization_config,
                    device_map="auto"
                )
                print("✓ 8-bit quantization applied successfully!", file=sys.stderr)
            except Exception as e:
                print(f"⚠ 8-bit quantization not available: {e}, using half precision...", file=sys.stderr)
                # Fallback to half precision (faster than float32)
                _model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16,
                    device_map="auto"
                )
            _model.eval()
        
        # Compile model for faster inference (PyTorch 2.0+)
        # This can provide 20-30% additional speedup
        if _device.type == "cuda":
            try:
                _model = torch.compile(_model, mode="reduce-overhead")
                print("✓ Model compiled for faster inference", file=sys.stderr)
            except Exception as e:
                print(f"⚠ Model compilation not available: {e}", file=sys.stderr)
        
        print(f"✓ NLLB model loaded successfully on {_device}", file=sys.stderr)
        return _tokenizer, _model, _device
    except Exception as e:
        raise Exception(f"Failed to load NLLB model: {str(e)}")

def translate_direct(text, src, tgt, fast_mode=False):
    """Direct translation using NLLB model with chunking for long texts.
    
    Args:
        text: Text to translate
        src: Source language code
        tgt: Target language code
        fast_mode: If True, use faster settings (fewer beams) for batch operations
    """
    # Acquire lock to ensure thread-safe model access (entire function must be serialized)
    with _model_lock:
        tokenizer, model, device = load_model()
        
        # Validate language codes
        if src not in LANG_CODES or tgt not in LANG_CODES:
            raise ValueError(f"Unsupported language pair: {src} -> {tgt}")
        
        src_code = LANG_CODES[src]
        tgt_code = LANG_CODES[tgt]
        
        # NLLB model max length is typically 1024 tokens
        max_model_length = 1024
        
        # Optimized chunking: use larger chunks for fewer API calls
        # Token estimate: ~3-4 chars per token for English, more for other languages
        # Use 90% of max tokens (922 tokens ≈ 3500-4000 chars) for maximum efficiency
        max_chunk_chars = max_model_length * 3.5  # ~3500 chars per chunk
        
        # For very long texts, split into sentences and translate in chunks
        if len(text) > max_chunk_chars:  # Only chunk if text is longer than one chunk
            # Split by sentences (period, exclamation, question mark followed by space or newline)
            sentences = re.split(r'([.!?]\s+)', text)
            
            # Recombine sentences with their punctuation
            sentence_list = []
            for i in range(0, len(sentences) - 1, 2):
                if i + 1 < len(sentences):
                    sentence_list.append(sentences[i] + sentences[i + 1])
                else:
                    sentence_list.append(sentences[i])
            
            # Group sentences into larger chunks for efficiency
            chunks = []
            current_chunk = ""
            for sentence in sentence_list:
                # Use larger chunks to reduce number of API calls
                if len(current_chunk) + len(sentence) > max_chunk_chars:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    current_chunk += sentence
            
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            # Translate each chunk
            translated_chunks = []
            total_chunks = len(chunks)
            for idx, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                try:
                    print(f"Translating chunk {idx + 1}/{total_chunks} (length: {len(chunk)})...", file=sys.stderr)
                    # Set source language
                    tokenizer.src_lang = src_code
                    
                    # Tokenize with truncation to max model length
                    inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=max_model_length)
                    
                    # Get actual input length to optimize output length
                    input_length = inputs['input_ids'].shape[1]
                    
                    # Get target language token ID (ensure it's an integer, not a tensor)
                    forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)
                    if isinstance(forced_bos_token_id, list):
                        forced_bos_token_id = forced_bos_token_id[0] if forced_bos_token_id else None
                    if forced_bos_token_id is None:
                        raise ValueError(f"Could not find token ID for target language: {tgt_code}")
                    
                    # Move inputs to device
                    inputs = {k: v.to(device) for k, v in inputs.items()}
                    
                    # Generate translation with maximum speed optimizations
                    with torch.no_grad():  # Disable gradient computation for inference
                        # Limit max_length to input_length * 1.5 to speed up generation
                        # Most translations are similar length or slightly longer
                        output_max_length = min(input_length + 200, max_model_length + 100)
                        
                        generated_tokens = model.generate(
                            **inputs,
                            forced_bos_token_id=forced_bos_token_id,
                            max_length=output_max_length,  # Much shorter for speed
                            num_beams=1,  # Greedy decoding (fastest)
                            do_sample=False,
                            pad_token_id=tokenizer.pad_token_id,
                            # Remove early_stopping (not valid with greedy)
                        )
                        
                        translated_chunk = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
                    translated_chunks.append(translated_chunk)
                    print(f"Chunk {idx + 1} translated successfully (output length: {len(translated_chunk)})", file=sys.stderr)
                except Exception as e:
                    print(f"Error translating chunk {idx + 1}: {str(e)}", file=sys.stderr)
                    # Fallback: return original chunk if translation fails
                    translated_chunks.append(chunk)
            
            result = " ".join(translated_chunks)
            print(f"Total translation complete: {len(result)} characters", file=sys.stderr)
            return result
        else:
            # Short text: translate directly
            try:
                # Set source language
                tokenizer.src_lang = src_code
                
                # Tokenize
                inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=max_model_length)
                
                # Get actual input length to optimize output length
                input_length = inputs['input_ids'].shape[1]
                
                # Get target language token ID (ensure it's an integer, not a tensor)
                forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)
                if isinstance(forced_bos_token_id, list):
                    forced_bos_token_id = forced_bos_token_id[0] if forced_bos_token_id else None
                if forced_bos_token_id is None:
                    raise ValueError(f"Could not find token ID for target language: {tgt_code}")
                
                # Move inputs to device
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                # Generate translation with maximum speed optimizations
                with torch.no_grad():  # Disable gradient computation for inference
                    # Limit max_length to input_length * 1.5 to speed up generation
                    output_max_length = min(input_length + 200, max_model_length + 100)
                    
                    # Greedy decoding - fastest option
                    generated_tokens = model.generate(
                        **inputs,
                        forced_bos_token_id=forced_bos_token_id,
                        max_length=output_max_length,  # Much shorter for speed
                        num_beams=1,  # Greedy decoding (fastest)
                        do_sample=False,
                        pad_token_id=tokenizer.pad_token_id,
                    )
                
                return tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
            except Exception as e:
                print(f"Error translating text: {str(e)}", file=sys.stderr)
                return text  # Return original on error

def translate(text, src, tgt, fast_mode=False):
    """
    Translation using NLLB model (supports direct translation between any language pair)
    
    Args:
        text: Text to translate
        src: Source language code
        tgt: Target language code
        fast_mode: If True, use faster settings for batch operations
    """
    if src == tgt:
        return text
    
    return translate_direct(text, src, tgt, fast_mode)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "translation", "model": "nllb-200"})

@app.route('/translate', methods=['POST'])
def translate_endpoint():
    """Translate text from source language to target language"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        text = data.get('text')
        source_lang = data.get('sourceLang', 'en')
        target_lang = data.get('targetLang', 'en')
        
        if not text:
            return jsonify({"error": "Text is required"}), 400
        
        if source_lang == target_lang:
            return jsonify({"translatedText": text})
        
        # Translate
        translated = translate(text, source_lang, target_lang)
        
        return jsonify({
            "translatedText": translated,
            "sourceLang": source_lang,
            "targetLang": target_lang
        })
        
    except Exception as e:
        print(f"Translation error: {str(e)}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

@app.route('/translate/batch', methods=['POST'])
def translate_batch_endpoint():
    """Translate multiple texts at once"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        texts = data.get('texts', [])
        source_lang = data.get('sourceLang', 'en')
        target_lang = data.get('targetLang', 'en')
        
        if not texts or not isinstance(texts, list):
            return jsonify({"error": "Texts array is required"}), 400
        
        if source_lang == target_lang:
            return jsonify({"translatedTexts": texts})
        
        # Translate all texts (use fast_mode for batch operations)
        # Process in batch for efficiency
        translated_texts = []
        total_texts = len(texts)
        for idx, text in enumerate(texts):
            if text:
                if idx % 10 == 0 and total_texts > 10:
                    print(f"Processing batch translation {idx + 1}/{total_texts}...", file=sys.stderr)
                translated = translate(text, source_lang, target_lang, fast_mode=True)
                translated_texts.append(translated)
            else:
                translated_texts.append("")
        
        return jsonify({
            "translatedTexts": translated_texts,
            "sourceLang": source_lang,
            "targetLang": target_lang
        })
        
    except Exception as e:
        print(f"Batch translation error: {str(e)}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    import os
    
    # Pre-load model on startup for faster first translation
    print("Pre-loading translation model on startup...", file=sys.stderr)
    try:
        load_model()
        print("✓ Model pre-loaded successfully! First translation will be fast.", file=sys.stderr)
    except Exception as e:
        print(f"⚠ Warning: Could not pre-load model: {e}", file=sys.stderr)
        print("Model will be loaded on first translation request.", file=sys.stderr)
    
    # Run on port 5000 (or PORT environment variable)
    port = int(os.environ.get('PORT', 5000))
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Starting NLLB translation service on port {port}...", file=sys.stderr)
    print(f"Device: {_device if _device else 'Will detect on first request'}", file=sys.stderr)
    print(f"Optimizations: Quantization, Model Compilation, Greedy Decoding", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
