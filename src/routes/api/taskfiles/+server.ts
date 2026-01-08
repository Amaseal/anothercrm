import { json } from '@sveltejs/kit';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { file } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Get the directory path for upload storage
function getUploadsDir() {
	// Always use uploads folder at project root in both dev and production
	return 'uploads';
}

// Ensure the upload directory exists
async function ensureUploadDir() {
	const uploadDir = getUploadsDir();
	try {
		await mkdir(uploadDir, { recursive: true });
	} catch (error) {
		console.warn('Upload directory already exists or cannot be created', error);
	}
	return uploadDir;
}

/**
 * Handle POST requests to upload task files
 * This will save the file to disk AND create a database entry
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const uploadedFile = formData.get('file') as File;
		// Optional task ID - if provided, will associate the file with this task immediately
		const taskId = formData.get('taskId') as string | null;

		if (!uploadedFile) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		// Sanitize the filename but preserve the original name
		const sanitizedName = uploadedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');

		// Get the file name and extension
		const lastDotIndex = sanitizedName.lastIndexOf('.');
		let fileName = sanitizedName;
		let fileExt = '';

		if (lastDotIndex > 0) {
			// If there's an extension
			fileName = sanitizedName.substring(0, lastDotIndex);
			fileExt = sanitizedName.substring(lastDotIndex); // includes the dot
		}

		// Add upload date in DD.MM.YY format
		const now = new Date();
		const day = String(now.getDate()).padStart(2, '0');
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const year = String(now.getFullYear()).slice(-2);
		const dateString = `${day}.${month}.${year}`;

		// Format: filename-DD.MM.YY.ext
		const filename = `${fileName}-${dateString}${fileExt}`; // Get upload directory and ensure it exists
		const uploadDir = await ensureUploadDir();
		const filePath = join(uploadDir, filename);

		// Write file to disk
		await writeFile(filePath, Buffer.from(await uploadedFile.arrayBuffer()));

		// Create the URL path - always /uploads regardless of environment
		const fileUrl = `/uploads/${filename}`;

		// Create a database entry for the file
		let newFile;

		if (taskId) {
			// If taskId is provided, associate with task
			[newFile] = await db
				.insert(file)
				.values({
					filename: uploadedFile.name, // Store original filename for display
					downloadUrl: fileUrl,
					size: uploadedFile.size,
					taskId: parseInt(taskId, 10)
				})
				.returning();
		} else {
			[newFile] = await db
				.insert(file)
				.values({
					filename: uploadedFile.name,
					downloadUrl: fileUrl,
					size: uploadedFile.size
				})
				.returning();
		}

		// Return the file information and database ID
		return json({
			success: true,
			url: fileUrl,
			filePath: fileUrl, // Store the URL path, not the filesystem path
			fileId: newFile.id,
			filename: uploadedFile.name,
			size: uploadedFile.size
		});
	} catch (error) {
		console.error('Task file upload error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};

/**
 * Handle DELETE requests to remove task files
 * This will remove both the file from disk AND the database entry
 */
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const { filePath, fileId } = await request.json();

		if (!filePath && !fileId) {
			return json({ success: false, error: 'No file path or ID provided' }, { status: 400 });
		}

		let fileRecord;
		// If fileId is provided, use it to find the file record
		if (fileId) {
			[fileRecord] = await db.select().from(file).where(eq(file.id, fileId));
			if (!fileRecord) {
				return json({ success: false, error: 'File record not found' }, { status: 404 });
			}
		}

		// Extract filename from path
		const downloadUrl = fileRecord?.downloadUrl || filePath;
		const filename = downloadUrl.split('/').pop();

		if (!filename) {
			return json({ success: false, error: 'Invalid file path' }, { status: 400 });
		}

		// Get upload directory and delete file
		const uploadDir = getUploadsDir();
		const fullPath = join(uploadDir, filename);

		try {
			const fs = await import('fs/promises');
			await fs.unlink(fullPath);
		} catch (deleteError) {
			console.error('File deletion from disk error:', deleteError);
			// Continue to delete the database record even if file deletion fails
		}
		// Delete the database record if we have an ID
		if (fileId) {
			await db.delete(file).where(eq(file.id, fileId));
		} else if (filePath) {
			// Try to find and delete by downloadUrl if only filePath was provided
			await db.delete(file).where(eq(file.downloadUrl, filePath));
		}

		return json({
			success: true,
			message: 'File deleted successfully'
		});
	} catch (error) {
		console.error('Task file delete error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};

/**
 * Handle GET requests to retrieve file information
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const fileId = url.searchParams.get('id');
		const filePath = url.searchParams.get('path');

		if (!fileId && !filePath) {
			return json({ success: false, error: 'No file ID or path provided' }, { status: 400 });
		}

		let fileRecord;
		// If fileId is provided, fetch file record from database
		if (fileId) {
			[fileRecord] = await db
				.select()
				.from(file)
				.where(eq(file.id, parseInt(fileId, 10)));
			if (!fileRecord) {
				return json({ success: false, error: 'File record not found' }, { status: 404 });
			}
		} else if (filePath) {
			// If only path is provided, try to find by downloadUrl
			[fileRecord] = await db.select().from(file).where(eq(file.downloadUrl, filePath));
		}

		// If no record found, check if the physical file exists
		if (!fileRecord && filePath) {
			// Extract filename from path
			const filename = filePath.split('/').pop();

			if (!filename) {
				return json({ success: false, error: 'Invalid file path' }, { status: 400 });
			}

			// Check if file exists
			const uploadDir = getUploadsDir();
			const fullPath = join(uploadDir, filename);

			try {
				const fs = await import('fs/promises');
				const stat = await fs.stat(fullPath);

				// Return file info for the physical file without DB record
				return json({
					success: true,
					url: filePath,
					filePath: filePath,
					fileInfo: {
						size: stat.size,
						mtime: stat.mtime,
						isFile: stat.isFile()
					}
				});
			} catch (statError) {
				return json(
					{
						success: false,
						error: 'File not found'
					},
					{ status: 404 }
				);
			}
		}

		// Return file info from the database record
		return json({
			success: true,
			url: fileRecord?.downloadUrl,
			filePath: fileRecord?.downloadUrl,
			fileId: fileRecord?.id,
			filename: fileRecord?.filename,
			size: fileRecord?.size,
			taskId: fileRecord?.taskId,
			fileInfo: {
				size: fileRecord?.size,
				mtime: fileRecord?.created_at,
				isFile: true
			}
		});
	} catch (error) {
		console.error('Task file info error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};
