FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite exposes 5173 by default, but we'll run it on 3000 mapping in compose
EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
