import { UserRole } from 'src/Enums/User.role';

export class Payload {
  sub: number;
  email: string;
  role: UserRole;  

  constructor(partial: Partial<Payload>) {
    Object.assign(this, partial);
  }
}
