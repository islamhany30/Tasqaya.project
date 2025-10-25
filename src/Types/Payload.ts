import { UserRole } from "./Enum.userrole";

export class Payload {
  sub: number;
  firstName: string;
  email: string;
  role:UserRole;

  constructor(partial: Partial<Payload>) {
    Object.assign(this, partial);
  }
}
