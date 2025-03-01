FROM node:18-alpine

WORKDIR /usr/src/app

# Install netcat for network checks
RUN apk add --no-cache netcat-openbsd

COPY package*.json ./
RUN npm install

COPY . .

# Make wait script executable
RUN chmod +x wait-for-postgres.sh

CMD ["sh", "-c", "./wait-for-postgres.sh && npm run dev"]