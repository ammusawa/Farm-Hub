/**
 * Database Articles Seeding Script
 * 
 * This script seeds the database with sample articles created by verified professional users
 * 
 * Usage: node scripts/seed-articles.js
 * 
 * Make sure to set your DATABASE_* environment variables first
 */

const mysql = require('mysql2/promise');

async function seedArticles() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'agriconsult_hub',
  });

  try {
    console.log('🌱 Starting articles seeding...\n');

    // Find verified professional users
    const [professionals] = await connection.execute(
      "SELECT id, name, email FROM users WHERE role = 'professional' AND isVerifiedProfessional = TRUE"
    );

    if (professionals.length === 0) {
      console.log('⚠️  No verified professional users found!');
      console.log('   Please run "npm run seed" first to create verified professionals.\n');
      process.exit(1);
    }

    console.log(`Found ${professionals.length} verified professional(s):`);
    professionals.forEach(p => {
      console.log(`   • ${p.name} (${p.email})`);
    });
    console.log('');

    // Sample articles data
    const articles = [
      {
        title: 'Best Practices for Maize Farming in Nigeria',
        body: `Maize (corn) is one of the most important cereal crops in Nigeria. Here are some best practices for successful maize farming:

1. **Land Preparation**: Clear the land and plow to a depth of 15-20cm. Remove weeds and debris.

2. **Seed Selection**: Choose high-yielding, disease-resistant varieties suitable for your region. Popular varieties include TZEE-Y, Oba Super 2, and Sammaz varieties.

3. **Planting**: Plant at the onset of rains, spacing 75cm between rows and 25cm within rows. Plant 2-3 seeds per hole at a depth of 3-5cm.

4. **Fertilization**: Apply NPK 15:15:15 at planting (200kg/ha) and top-dress with Urea (100kg/ha) 3-4 weeks after planting.

5. **Weed Control**: Weed 2-3 weeks after planting and again 5-6 weeks after planting.

6. **Pest and Disease Management**: Monitor for armyworms, stem borers, and leaf blight. Use appropriate pesticides when necessary.

7. **Harvesting**: Harvest when the husks turn brown and kernels are hard. This is usually 90-120 days after planting.

Remember to practice crop rotation and maintain soil fertility for sustainable farming.`,
        language: 'en',
        cropType: 'Maize',
        contentType: 'article',
        tags: 'maize, corn, farming, best practices, Nigeria, cereal crops'
      },
      {
        title: 'Hanyoyin Noman Masara a Najeriya',
        body: `Masara ita ce daya daga cikin manyan amfanin gona a Najeriya. Ga wasu hanyoyin da za a bi don samun nasara:

1. **Shirya Ƙasa**: Share ƙasa kuma a yi noma har zuwa zurfin 15-20cm. Cire ciyawa da datti.

2. **Zaɓin Iri**: Zaɓi nau'ukan da ke da yawan amfanin gona, masu jure cututtuka da suka dace da yankinku. Shaharrun nau'uka sun haɗa da TZEE-Y, Oba Super 2, da nau'ukan Sammaz.

3. **Shuka**: Shuka a lokacin fara ruwan sama, tazarar 75cm tsakanin layuka da 25cm a cikin layuka. Shuka iri 2-3 a kowane rami a zurfin 3-5cm.

4. **Takarda**: Yi amfani da NPK 15:15:15 a lokacin shuka (200kg/ha) kuma a yi takarda da Urea (100kg/ha) bayan makonni 3-4.

5. **Kula da Ciyawa**: Cire ciyawa bayan makonni 2-3 bayan shuka kuma sake yin haka bayan makonni 5-6.

6. **Kula da Kwari da Cututtuka**: Lura da kwari kamar armyworms, stem borers, da leaf blight. Yi amfani da magungunan kashe kwari idan ya cancanta.

7. **Girbi**: Girbe lokacin da husks suka zama launin ruwan kasa kuma kernels suna da ƙarfi. Wannan yawanci yana ɗaukar kwanaki 90-120 bayan shuka.

Ka tuna da yin juyawa da amfanin gona da kuma kiyaye ƙarfin ƙasa don noma mai dorewa.`,
        language: 'ha',
        cropType: 'Masara',
        contentType: 'article',
        tags: 'masara, noma, Najeriya, amfanin gona'
      },
      {
        title: 'Usoro Ọrụ Ugbo Osikapa na Mma',
        body: `Osikapa bụ otu n'ime ihe ọkụkụ kachasị mkpa na Naịjirịa. Nke a bụ ụfọdụ usoro ọrụ ugbo kachasị mma:

1. **Nkwadebe Ala**: Kpochaa ala ma kọọ ya ruo omimi nke 15-20cm. Wepụ ahịhịa na ihe mkpofu.

2. **Nhọrọ Mkpụrụ**: Họrọ ụdị ndị na-amịpụta nke ọma, na-eguzogide ọrịa nke dabara na mpaghara gị. Ụdị ndị a ma ama gụnyere FARO 44, FARO 52, na NERICA varieties.

3. **Ịkụ Ihe**: Kụọ n'oge mmiri ozuzo malitere, nwee oghere nke 20cm n'etiti ahịrị na 20cm n'ime ahịrị. Kụọ mkpụrụ 2-3 n'otu oghere na omimi nke 2-3cm.

4. **Fatịlaịza**: Tinye NPK 15:15:15 mgbe ị na-akụ (200kg/ha) ma tinye Urea (100kg/ha) mgbe izu 3-4 gachara.

5. **Ijikwa Ahịhịa**: Wepụ ahịhịa mgbe izu 2-3 gachara ịkụ ma ọzọ mgbe izu 5-6 gachara.

6. **Ijikwa Ụmụ Ahụhụ na Ọrịa**: Lelee maka armyworms, stem borers, na leaf blight. Jiri ọgwụ mgbochi kwesịrị ekwesị mgbe ọ dị mkpa.

7. **Iwe Ihe Ubi**: Weta ihe ubi mgbe husks gbanwere aja aja na kernels siri ike. Nke a na-adịkarị ụbọchị 120-150 mgbe ịkụchara.

Cheta na ị na-eme mgbanwe ihe ọkụkụ na ịnọgide na-edobe ala maka ọrụ ugbo na-adịgide adịgide.`,
        language: 'ig',
        cropType: 'Osikapa',
        contentType: 'article',
        tags: 'osikapa, ọrụ ugbo, Naịjirịa, ihe ọkụkụ'
      },
      {
        title: 'Awọn Ilana Ti o Dara Ju Fun Ikọ-ọgbin Iresi',
        body: `Iresi jẹ ọkan ninu awọn ọgbẹ ti o ṣe pataki julọ ni Nàìjíríà. Eyi ni awọn ilana ti o dara julọ:

1. **Iparada Ilẹ**: Nu ilẹ kuro ki o ge si ijinle ti 15-20cm. Yọ awọn koriko ati awọn idọti kuro.

2. **Yiyan Irúgbìn**: Yan awọn irúgbìn ti o pọn dandan, ti o le dẹkun aisan ti o baamu agbegbe rẹ. Awọn irúgbìn ti o gbajumo pẹlu FARO 44, FARO 52, ati awọn irúgbìn NERICA.

3. **Gígùn**: Gùn ni akoko ojo bẹrẹ, pẹlu aaye ti 20cm laarin awọn ila ati 20cm ninu awọn ila. Gùn awọn irúgbìn 2-3 ni ọkan iho ni ijinle ti 2-3cm.

4. **Fertilization**: Fi NPK 15:15:15 ni akoko gigun (200kg/ha) ki o fi Urea (100kg/ha) lori ni ọsẹ 3-4 lẹhin gigun.

5. **Iṣakoso Koriko**: Yọ koriko kuro ni ọsẹ 2-3 lẹhin gigun ati lẹẹkansi ni ọsẹ 5-6 lẹhin gigun.

6. **Iṣakoso Kokoro ati Aisan**: Ṣe ayẹwo fun armyworms, stem borers, ati leaf blight. Lo awọn oogun ti o tọ nigba ti o ba nilo.

7. **Ikore**: Ikore nigba ti awọn husks ba yi padà ati awọn kernels ti sẹ. Eyi nigbagbogbo jẹ ọjọ 120-150 lẹhin gigun.

Ranti lati ṣe ayipada ọgbẹ ati lati ṣe agbekalẹ ilẹ fun ikọ-ọgbin ti o duro.`,
        language: 'yo',
        cropType: 'Iresi',
        contentType: 'article',
        tags: 'iresi, ikọ-ọgbin, Nàìjíríà, ọgbẹ'
      },
      {
        title: 'Cassava Farming: A Complete Guide',
        body: `Cassava is a staple food crop in Nigeria and a major source of carbohydrates. Here's a comprehensive guide:

1. **Land Selection**: Cassava grows well in well-drained sandy loam or loamy soil. Avoid waterlogged areas.

2. **Stem Selection**: Use healthy, disease-free stems from mature plants (8-12 months old). Cut stems into 20-25cm pieces.

3. **Planting**: Plant at 45-degree angle or vertically, spacing 1m x 1m. Plant at the beginning of the rainy season.

4. **Fertilization**: Apply organic manure or NPK fertilizer. Cassava responds well to potassium.

5. **Weed Control**: Weed 3-4 times during the growing season, especially in the first 3 months.

6. **Pest Management**: Watch for cassava mealybug, green mite, and cassava mosaic disease. Use resistant varieties when available.

7. **Harvesting**: Harvest 8-12 months after planting. Signs of maturity include yellowing leaves and easy stem breakage.

8. **Post-Harvest**: Process cassava quickly to prevent deterioration. Can be processed into garri, fufu, or starch.

Cassava is drought-tolerant and can grow in poor soils, making it ideal for smallholder farmers.`,
        language: 'en',
        cropType: 'Cassava',
        contentType: 'article',
        tags: 'cassava, farming, Nigeria, staple food, carbohydrates'
      },
      {
        title: 'Tomato Production Tips for Small-Scale Farmers',
        body: `Tomatoes are high-value crops that can generate good income. Follow these tips:

1. **Variety Selection**: Choose varieties suited to your climate. Popular ones include Roma, UC82B, and local varieties.

2. **Nursery Management**: Start seeds in nursery beds or trays. Transplant when seedlings are 3-4 weeks old with 4-5 true leaves.

3. **Field Preparation**: Prepare raised beds 1m wide. Apply well-decomposed manure (10-15 tons/ha) before planting.

4. **Spacing**: Space plants 60cm between rows and 50cm within rows for indeterminate varieties.

5. **Watering**: Tomatoes need consistent moisture. Water in the morning, avoid wetting leaves to prevent diseases.

6. **Staking**: Support plants with stakes or trellises to keep fruits off the ground and improve air circulation.

7. **Fertilization**: Apply NPK 15:15:15 at planting, then top-dress with Urea and Potassium during flowering and fruiting.

8. **Pest and Disease Control**: Monitor for tomato fruitworm, whiteflies, and blight. Use integrated pest management.

9. **Harvesting**: Harvest when fruits are firm and fully colored. Handle carefully to avoid bruising.

With proper management, tomatoes can yield 20-40 tons per hectare.`,
        language: 'en',
        cropType: 'Tomato',
        contentType: 'article',
        tags: 'tomato, vegetables, high-value crops, income generation'
      },
      {
        title: 'Organic Farming Methods for Sustainable Agriculture',
        body: `Organic farming promotes environmental health and sustainable food production:

1. **Soil Health**: Build soil fertility using compost, green manure, and crop rotation. Avoid synthetic chemicals.

2. **Composting**: Create compost from farm waste, kitchen scraps, and animal manure. Turn regularly for proper decomposition.

3. **Natural Pest Control**: 
   - Use companion planting (e.g., marigolds with tomatoes)
   - Introduce beneficial insects
   - Use neem oil and other natural pesticides
   - Practice crop rotation

4. **Weed Management**: Use mulching, hand weeding, and cover crops instead of herbicides.

5. **Water Conservation**: Practice rainwater harvesting, drip irrigation, and mulching to conserve water.

6. **Seed Saving**: Save seeds from healthy plants for next season. This preserves local varieties and reduces costs.

7. **Livestock Integration**: Combine crop and livestock farming for nutrient cycling and additional income.

8. **Certification**: Consider organic certification if selling to premium markets.

Organic farming may have lower initial yields but provides long-term soil health and environmental benefits.`,
        language: 'en',
        cropType: 'General',
        contentType: 'article',
        tags: 'organic farming, sustainable agriculture, environmental health, compost'
      },
      {
        title: 'Rice Farming: From Seed to Harvest',
        body: `Rice is a major food crop in Nigeria. Here's a step-by-step guide:

1. **Land Preparation**: 
   - Clear and level the field
   - Construct bunds (ridges) to hold water
   - Flood the field and puddle the soil

2. **Seed Selection and Treatment**:
   - Use certified seeds
   - Soak seeds for 24 hours
   - Pre-germinate for 24-48 hours

3. **Nursery Establishment**:
   - Prepare seedbed (1/10 of main field)
   - Broadcast pre-germinated seeds
   - Maintain water level at 2-5cm

4. **Transplanting**:
   - Transplant 21-30 days after sowing
   - Use 2-3 seedlings per hill
   - Spacing: 20cm x 20cm

5. **Water Management**:
   - Maintain 5-7cm water depth during growth
   - Drain 2 weeks before harvest

6. **Fertilization**:
   - Apply NPK at transplanting
   - Top-dress with Urea at tillering and heading stages

7. **Weed Control**: Hand weed or use herbicides. Critical in first 6 weeks.

8. **Harvesting**: Harvest when 80% of grains are mature (yellow). Dry to 14% moisture before storage.

Proper rice farming can yield 4-6 tons per hectare.`,
        language: 'en',
        cropType: 'Rice',
        contentType: 'article',
        tags: 'rice, cereal crops, food security, Nigeria'
      },
      {
        title: 'Quick Tips: Soil Testing for Better Yields',
        body: `Understanding your soil is key to successful farming:

1. **Why Test Soil?**: 
   - Know nutrient levels
   - Determine fertilizer needs
   - Identify pH problems
   - Save money on unnecessary inputs

2. **When to Test**: Test before planting season, or every 2-3 years.

3. **What to Test**:
   - pH level (ideal: 6.0-7.0 for most crops)
   - Nitrogen, Phosphorus, Potassium (NPK)
   - Organic matter content
   - Soil texture

4. **How to Collect Samples**:
   - Take samples from multiple spots (15-20 spots per field)
   - Sample at root depth (0-20cm)
   - Mix samples and send to lab

5. **Interpreting Results**: 
   - Follow lab recommendations
   - Adjust pH with lime (if too acidic) or sulfur (if too alkaline)
   - Apply fertilizers based on crop needs

6. **DIY Testing**: Simple pH tests can be done at home with test kits.

Regular soil testing helps optimize fertilizer use and improve yields.`,
        language: 'en',
        cropType: 'General',
        contentType: 'tip',
        tags: 'soil testing, soil health, fertilizer, crop yields'
      },
      {
        title: 'Irrigation Methods for Small Farms',
        body: `Efficient water management is crucial for farming success:

1. **Drip Irrigation**:
   - Most water-efficient method
   - Delivers water directly to plant roots
   - Reduces weed growth
   - Best for vegetables and fruit trees

2. **Sprinkler Irrigation**:
   - Good for field crops
   - Covers large areas
   - Can be mobile or fixed

3. **Furrow Irrigation**:
   - Water flows in channels between rows
   - Suitable for row crops
   - Requires land leveling

4. **Flood Irrigation**:
   - Traditional method
   - Used for rice and some field crops
   - Less efficient but low cost

5. **Rainwater Harvesting**:
   - Collect and store rainwater
   - Use for dry season farming
   - Reduces dependence on unreliable rainfall

6. **Water Conservation Tips**:
   - Mulch to reduce evaporation
   - Water in early morning or evening
   - Use drought-resistant varieties
   - Practice crop rotation

Choose irrigation method based on crop type, water availability, and budget.`,
        language: 'en',
        cropType: 'General',
        contentType: 'tip',
        tags: 'irrigation, water management, farming efficiency, drought'
      }
    ];

    // Distribute articles among verified professionals
    let articleIndex = 0;
    const createdArticles = [];

    for (const article of articles) {
      const professional = professionals[articleIndex % professionals.length];
      
      await connection.execute(
        `INSERT INTO content (title, body, language, authorId, cropType, contentType, tags, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          article.title,
          article.body,
          article.language,
          professional.id,
          article.cropType,
          article.contentType,
          article.tags
        ]
      );

      createdArticles.push({
        title: article.title,
        author: professional.name,
        language: article.language,
        cropType: article.cropType,
        contentType: article.contentType
      });

      articleIndex++;
    }

    console.log('✅ Articles seeded successfully!\n');
    console.log(`📝 Created ${createdArticles.length} articles:\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    createdArticles.forEach((article, index) => {
      console.log(`\n${index + 1}. ${article.title}`);
      console.log(`   Author: ${article.author}`);
      console.log(`   Language: ${article.language.toUpperCase()}`);
      console.log(`   Crop: ${article.cropType}`);
      console.log(`   Type: ${article.contentType}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Articles are now available in the system!');
    console.log('   You can view them at: http://localhost:3000\n');

  } catch (error) {
    console.error('❌ Error seeding articles:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedArticles();

