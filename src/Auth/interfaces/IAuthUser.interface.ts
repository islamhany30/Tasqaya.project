export interface IAuthUser {
  findByEmail(email: string): Promise<any>;

  findById(id: number): Promise<any>;

  validatePassword(plainText: string, user: any): Promise<boolean>;

  setVerificationCode(userId: number, code: string, expiry: Date): Promise<void>;

  setResetCode(email: string, code: string, expiry: Date): Promise<void>;

  verifyUser(userId: number): Promise<void>;

  updatePassword(userId: number, hashedPassword: string): Promise<void>;

  clearResetCode(userId: number): Promise<void>;

  createUser(data: any): Promise<any>;
}
