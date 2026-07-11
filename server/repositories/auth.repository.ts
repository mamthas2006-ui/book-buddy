import { prisma } from "../config/prisma";
import { RegisterInput } from "../validation/auth.validation";
import { Role } from "../constants";

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async createUser(data: RegisterInput & { passwordHash: string; role?: Role }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || "USER",
        profile: {
          create: {},
        },
      },
      include: { profile: true },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async storeRefreshToken(userId: string, token: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeRefreshToken(token: string) {
    return prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  }

  async revokeAllUserTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async storeEmailVerifyToken(userId: string, token: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifyToken: token },
    });
  }

  async verifyUserEmail(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifyToken: null },
    });
  }

  async storePasswordResetToken(userId: string, token: string, expiry: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });
  }

  async findUserByResetToken(token: string) {
    return prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });
  }

  async upsertGoogleUser(data: { googleId: string; email: string; name: string; avatarUrl?: string }) {
    // 1. Check by googleId
    let user = await prisma.user.findUnique({
      where: { googleId: data.googleId },
      include: { profile: true },
    });

    if (user) {
      return user;
    }

    // 2. Check if a user with this email exists but without googleId linked
    user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (user) {
      // Link the existing user account
      return prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: data.googleId,
          emailVerified: true,
          avatarUrl: data.avatarUrl || user.avatarUrl,
        },
        include: { profile: true },
      });
    }

    // 3. Create a brand new user aligned with their googleId/Firebase Auth UID
    return prisma.user.create({
      data: {
        id: data.googleId,
        name: data.name,
        email: data.email,
        googleId: data.googleId,
        avatarUrl: data.avatarUrl,
        emailVerified: true,
        role: "USER",
        profile: {
          create: {},
        },
      },
      include: { profile: true },
    });
  }
}
