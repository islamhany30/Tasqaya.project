import { IsEnum } from 'class-validator';
import { UserRole } from 'src/Types/Enum.userrole';

export class ChangeRoleDto {
  @IsEnum(UserRole, { message: 'Role must be either "user" or "admin"' })
  newRole: UserRole;
}
