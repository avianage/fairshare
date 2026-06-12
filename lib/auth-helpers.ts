import { prisma } from "@/lib/prisma"

/**
 * Thrown when a user is not authorized to act on a group.
 * API routes catch this and translate it into a 403 response.
 */
export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/**
 * Ensure `userId` is a member of `groupId`. Returns the membership record.
 * Throws ForbiddenError if the user is not a member.
 *
 * Call this at the top of EVERY group API route before any other DB work.
 */
export async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })
  if (!member) throw new ForbiddenError()
  return member
}

/**
 * Ensure `userId` is an ADMIN of `groupId`. Returns the membership record.
 * Throws ForbiddenError if the user is not a member or not an admin.
 */
export async function requireGroupAdmin(groupId: string, userId: string) {
  const member = await requireGroupMember(groupId, userId)
  if (member.role !== "ADMIN") throw new ForbiddenError()
  return member
}
