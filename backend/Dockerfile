FROM node:22

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

COPY . .

EXPOSE 5000

# Generate prisma client, sync schema, and then run using ts-node
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --accept-data-loss && npx ts-node src/index.ts"]
