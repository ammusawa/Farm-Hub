'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface SuggestedVideo {
	id: number;
	title: string;
	authorId?: number | null;
	authorName: string;
	createdAt: string;
	contentType?: string | null;
	videoFile?: string | null;
	videoDuration?: number | null;
	language?: string | null;
	cropType?: string | null;
	avgRating?: number | null;
	ratingCount?: number | null;
}

interface SuggestedVideosProps {
	currentId: number;
	language?: string | null;
	cropType?: string | null;
	contentType?: string | null;
	limit?: number;
	translateTo?: string | null;
}

export default function SuggestedVideos({ currentId, language, cropType, contentType, limit = 12, translateTo }: SuggestedVideosProps) {
	const [videos, setVideos] = useState<SuggestedVideo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchSuggestions = async () => {
			try {
				const params = new URLSearchParams();
				// Use the same content type as the current content (required for suggestions)
				if (contentType) {
					params.set('type', contentType);
				}
				// Don't filter by language or cropType for suggestions to show more results
				// Users can discover content in different languages and about different crops
				params.set('limit', String(limit));
				// Only add translate parameter if not 'default'
				if (translateTo && translateTo !== 'default') {
					params.set('translate', translateTo);
				}

				const res = await fetch(`/api/content?${params.toString()}`);
				const data = await res.json();
				const list: SuggestedVideo[] = (data.content || []).filter((v: any) => v.id !== currentId);
				setVideos(list);
			} catch (e) {
				console.error('Error fetching suggestions:', e);
				setVideos([]);
			} finally {
				setLoading(false);
			}
		};
		fetchSuggestions();
	}, [currentId, contentType, limit, translateTo]);

	if (loading) {
		return (
			<div className="text-sm text-gray-500">Loading suggestions...</div>
		);
	}

	if (!videos.length) {
		return (
			<div className="text-sm text-gray-500 text-center py-4">
				No {contentType || 'content'} suggestions available at the moment.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{videos.map((v) => (
				<SuggestedItem key={v.id} video={v} />
			))}
		</div>
	);
}

function formatDuration(seconds?: number | null) {
	if (!seconds || Number.isNaN(seconds)) return null;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function timeAgo(dateString: string) {
	const date = new Date(dateString);
	const now = new Date();
	const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const mins = Math.floor(diff / 60);
	if (mins < 60) return rtf.format(-mins, 'minute');
	const hours = Math.floor(mins / 60);
	if (hours < 24) return rtf.format(-hours, 'hour');
	const days = Math.floor(hours / 24);
	if (days < 7) return rtf.format(-days, 'day');
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return rtf.format(-weeks, 'week');
	const months = Math.floor(days / 30);
	if (months < 12) return rtf.format(-months, 'month');
	const years = Math.floor(days / 365);
	return rtf.format(-years, 'year');
}

function SuggestedItem({ video }: { video: SuggestedVideo }) {
	const router = useRouter();
	const videoRef = useRef<HTMLVideoElement>(null);
	const isVideo = video.contentType === 'video';
	const authorProfileHref = video.authorId
		? `/?authorId=${video.authorId}&authorName=${encodeURIComponent(video.authorName)}`
		: null;
	
	useEffect(() => {
		if (!isVideo) return;
		const v = videoRef.current;
		if (!v) return;
		const onLoaded = () => {
			try {
				v.currentTime = 1;
			} catch {}
		};
		v.addEventListener('loadedmetadata', onLoaded);
		return () => v.removeEventListener('loadedmetadata', onLoaded);
	}, [isVideo]);

	const getIcon = () => {
		if (video.contentType === 'article') {
			return '📄';
		} else if (video.contentType === 'tip') {
			return '💡';
		}
		return '🎥';
	};

	return (
		<Link href={`/content/${video.id}`} className="flex gap-3">
			<div className="relative w-44 flex-shrink-0 bg-black rounded-lg overflow-hidden aspect-video">
				{isVideo && video.videoFile ? (
					<video
						ref={videoRef}
						src={video.videoFile}
						className="w-full h-full object-cover"
						muted
						playsInline
						preload="metadata"
					/>
				) : (
					<div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
						<span className="text-4xl">{getIcon()}</span>
					</div>
				)}
				{isVideo && formatDuration(video.videoDuration) && (
					<div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
						{formatDuration(video.videoDuration)}
					</div>
				)}
				{!isVideo && (
					<div className="absolute top-1 left-1 bg-primary-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">
						{video.contentType}
					</div>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{video.title}</h4>
				<p className="text-xs text-gray-600 mt-1">
					{authorProfileHref ? (
						<span
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								router.push(authorProfileHref);
							}}
							className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
						>
							{video.authorName}
						</span>
					) : (
						video.authorName
					)}
				</p>
				<div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
					{video.ratingCount && video.ratingCount > 0 && (
						<span>⭐ {parseFloat(String(video.avgRating || 0)).toFixed(1)} ({video.ratingCount})</span>
					)}
					{video.ratingCount && video.ratingCount > 0 && <span>•</span>}
					<span>{timeAgo(video.createdAt)}</span>
				</div>
			</div>
		</Link>
	);
}


