import { IsEmail, IsString } from "class-validator";


export class verifyresetpassDto
{
    @IsEmail()
    email: string;

    @IsString()
    code:string;
}