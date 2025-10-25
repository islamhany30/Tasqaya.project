import { JwtService } from '@nestjs/jwt';
import { Payload } from 'src/Types/Payload';

export const generateToken = (jwtService: JwtService, payload: Payload) => {
  return jwtService.sign(payload);
};
