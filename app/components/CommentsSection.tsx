'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Comment {
  id: number;
  userId: number;
  userName: string;
  message: string;
  createdAt: string;
  replies?: Comment[];
}

interface CommentsSectionProps {
  contentId: number;
  user: any;
}

export default function CommentsSection({ contentId, user }: CommentsSectionProps) {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadComments();
  }, [contentId]);

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/comments?contentId=${contentId}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(t('comments.loginToComment'));
      return;
    }

    if (!newComment.trim()) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          message: newComment,
        }),
      });

      if (res.ok) {
        setNewComment('');
        loadComments();
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  };

  const handleReply = async (parentId: number) => {
    if (!user) {
      alert(t('comments.loginToReply'));
      return;
    }

    if (!replyText.trim()) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          parentId,
          message: replyText,
        }),
      });

      if (res.ok) {
        setReplyText('');
        setReplyingTo(null);
        loadComments();
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
    }
  };

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : ''} mb-4`}>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="font-semibold text-gray-800">{comment.userName}</span>
            <span className="text-sm text-gray-500 ml-2">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <p className="text-gray-700 mb-2">{comment.message}</p>
        {user && depth < 2 && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {replyingTo === comment.id ? t('comments.cancel') : t('comments.reply')}
          </button>
        )}
        {replyingTo === comment.id && (
          <div className="mt-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('comments.writeReply')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
              rows={2}
            />
            <button
              onClick={() => handleReply(comment.id)}
              className="px-4 py-1 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
            >
              {t('comments.submitReply')}
            </button>
          </div>
        )}
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">{t('comments.title')}</h2>

      {user ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('comments.writeComment')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
            rows={3}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('comments.submit')}
          </button>
        </form>
      ) : (
        <div className="mb-6 text-gray-500">
          Please <a href="/login" className="text-primary-600">{t('comments.loginLink')}</a> to comment or ask questions.
        </div>
      )}

      <div>
        {comments.length === 0 ? (
          <p className="text-gray-500">{t('comments.noComments')}</p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}

