import { IsEmail, IsString, Length } from "class-validator";

export class MailDTO{
    @IsEmail()
    email: string;
    
    @IsString()
    @Length(6, 6, { message: 'Verification code must be 6 digits' })
    VERFICATIONCODE:string
}