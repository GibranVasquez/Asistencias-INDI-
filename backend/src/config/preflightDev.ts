import { config as cargarDotenv } from "dotenv";
import { exigirHostLocal } from "./hostGuard";

cargarDotenv({ quiet: true });
exigirHostLocal("DATABASE_URL");
