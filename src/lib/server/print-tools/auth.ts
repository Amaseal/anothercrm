import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { printToolsToken, user } from '$lib/server/db/schema';
import { assertProductionStaff, productionId } from '$lib/server/production';

export async function authenticatePrintTools(request: Request) {
	const token = request.headers.get('x-api-key') ?? '';
	if (!/^pt_[a-f0-9]{64}$/.test(token))
		error(401, 'Configure a CRM Print Tools credential from Production in CRM.');
	const hash = createHash('sha256').update(token).digest('hex');
	const [owner] = await db
		.select({ id: user.id })
		.from(printToolsToken)
		.innerJoin(user, eq(user.id, printToolsToken.userId))
		.where(
			and(
				eq(printToolsToken.tokenHash, hash),
				gt(printToolsToken.expiresAt, new Date()),
				eq(user.type, 'admin')
			)
		);
	if (!owner)
		error(401, 'CRM Print Tools credential expired or revoked. Create a new credential in CRM.');
	return owner;
}

export async function listPrintToolsTokens(locals: App.Locals) {
	assertProductionStaff(locals);
	return db
		.select({
			id: printToolsToken.id,
			createdAt: printToolsToken.createdAt,
			expiresAt: printToolsToken.expiresAt
		})
		.from(printToolsToken)
		.where(eq(printToolsToken.userId, locals.user!.id));
}

export async function createPrintToolsToken(locals: App.Locals) {
	assertProductionStaff(locals);
	const token = `pt_${randomBytes(32).toString('hex')}`;
	await db.transaction(async (tx) => {
		await tx.select({ id: user.id }).from(user).where(eq(user.id, locals.user!.id)).for('update');
		const active = await tx
			.select({ id: printToolsToken.id })
			.from(printToolsToken)
			.where(
				and(eq(printToolsToken.userId, locals.user!.id), gt(printToolsToken.expiresAt, new Date()))
			);
		if (active.length >= 20)
			error(409, 'Revoke unused Print Tools credentials before creating another.');
		await tx.insert(printToolsToken).values({
			userId: locals.user!.id,
			tokenHash: createHash('sha256').update(token).digest('hex'),
			expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
		});
	});
	return token;
}

export async function revokePrintToolsToken(locals: App.Locals, id: unknown) {
	assertProductionStaff(locals);
	await db
		.delete(printToolsToken)
		.where(
			and(eq(printToolsToken.id, productionId(id)), eq(printToolsToken.userId, locals.user!.id))
		);
}
