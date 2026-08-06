# node:22-alpine para que coincida con @types/node (^22.x en package.json),
# no con la version de Node del sandbox de desarrollo (que puede ser mas
# nueva/distinta a la que el proyecto realmente apunta).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Solo schema.prisma, NO toda la carpeta prisma/: `npx prisma generate`
# (mas abajo, y el postinstall que dispara `npm ci`) unicamente necesita el
# schema - prisma/seed-data/roster_enrolamiento_tren_golfo.json (datos
# reales de los 137 trabajadores, con nombres) no tiene ningun motivo para
# estar en una imagen que corre en runtime: el seed se corre a mano desde
# una maquina de desarrollo (ver CLAUDE.md), nunca dentro del contenedor.
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# node:22-alpine corre en UTC por defecto (bug real: GET /secciones/:id/hoy
# calculaba "hoy" con el reloj del contenedor, adelantandose ~5-6h al dia
# real de Mexico cada tarde). El codigo que depende de esto ya usa
# Intl.DateTimeFormat con timeZone explicito (no depende de esto para ser
# correcto), pero fijar TZ aqui es la capa de infraestructura: cualquier
# `new Date()` + getters locales que se agregue despues (aqui o en una
# libreria) queda correcto por default en vez de silenciosamente en UTC.
# tzdata explicito porque alpine no lo trae preinstalado (musl necesita los
# archivos de zoneinfo para que TZ resuelva a algo real, no solo el ICU que
# trae Node compilado).
RUN apk add --no-cache tzdata
ENV TZ=America/Mexico_City

COPY package.json package-lock.json ./
# Solo schema.prisma, NO toda la carpeta prisma/: `npx prisma generate`
# (mas abajo, y el postinstall que dispara `npm ci`) unicamente necesita el
# schema - prisma/seed-data/roster_enrolamiento_tren_golfo.json (datos
# reales de los 137 trabajadores, con nombres) no tiene ningun motivo para
# estar en una imagen que corre en runtime: el seed se corre a mano desde
# una maquina de desarrollo (ver CLAUDE.md), nunca dentro del contenedor.
COPY prisma/schema.prisma ./prisma/schema.prisma
# --omit=dev + generate explicito: no depender de que el postinstall de
# @prisma/client corra solo dentro de este stage (mismo criterio que ya
# probamos en el "fresh clone test" del build de Railway - ahi si corria
# solo, pero aqui se deja explicito para no depender de ese detalle).
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/dist ./dist
# certs/ no pasa por tsc (no es codigo, son .pem estaticos) - src/utils/prisma.ts
# los lee via __dirname en runtime (ver CLAUDE.md, seccion Environment).
COPY certs ./certs

EXPOSE 4000

CMD ["node", "dist/index.js"]
