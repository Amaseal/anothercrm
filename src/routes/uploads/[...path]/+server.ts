import type { RequestHandler } from '@sveltejs/kit';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import mime from 'mime-types';

function safeDecodePathSegment(input: string): string {
	try {
		return decodeURIComponent(input);
	} catch {
		return input;
	}
}

function getLegacyPathCandidates(path: string): string[] {
	const trimmedEnd = path.trimEnd();
	const candidates = [path, trimmedEnd, `${trimmedEnd} `];

	return Array.from(new Set(candidates.filter(Boolean)));
}

// Get the uploads directory path
function getUploadsDir() {
	// Always use uploads folder at project root in both dev and production
	return 'uploads';
}

export const GET: RequestHandler = async ({ params }) => {
	const { path } = params;

	if (!path) {
		return new Response('Not found', { status: 404 });
	}

	// Sanitize the path to prevent directory traversal
	const decodedPath = safeDecodePathSegment(path);
	const sanitizedPath = decodedPath.replace(/\.\./g, '').replace(/^\/+/, '');
	const uploadsDir = getUploadsDir();

	let resolvedPath: string | null = null;
	for (const candidate of getLegacyPathCandidates(sanitizedPath)) {
		const candidatePath = join(uploadsDir, candidate);
		try {
			const candidateStats = await stat(candidatePath);
			if (candidateStats.isFile()) {
				resolvedPath = candidatePath;
				break;
			}
		} catch {
			// Try next candidate path.
		}
	}

	if (!resolvedPath) {
		return new Response('Not found', { status: 404 });
	}

	try {
		// Read the file
		const fileBuffer = await readFile(resolvedPath);
		// Convert Buffer to Uint8Array for Response compatibility
		const uint8Array = new Uint8Array(fileBuffer as unknown as ArrayBuffer);
		// Determine the MIME type
		const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';

		// Return the file with appropriate headers
		return new Response(uint8Array, {
			headers: {
				'Content-Type': mimeType,
				'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
			}
		});
	} catch (error) {
		console.error('Error serving file:', error);
		return new Response('Not found', { status: 404 });
	}
};
