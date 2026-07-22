import { Router } from "express";
import { cambiarPassword, login, usuarioActual } from "../controllers/auth.controller";
import { loginTerminal } from "../controllers/authTerminal.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { limitadorLogin } from "../middlewares/rateLimit";
import { validarCambioPropiaPassword } from "../middlewares/validarPassword";
import { validarLogin } from "../middlewares/validarLogin";

export const authRouter = Router();

authRouter.post("/login", limitadorLogin, validarLogin, login);
authRouter.get("/usuario-actual", authMiddleware, usuarioActual);
// Mismo validador que el login humano: solo valida que username/password
// sean strings no vacíos, no le importa a qué modelo pertenecen.
authRouter.post("/login-terminal", limitadorLogin, validarLogin, loginTerminal);
// Autoservicio: cualquier cuenta logueada (cualquier rol) cambia su propia
// contraseña conociendo la actual — no gateado por rol como el resto de
// /usuarios, porque aplica a todas las cuentas por igual.
authRouter.patch("/cambiar-password", authMiddleware, validarCambioPropiaPassword, cambiarPassword);
