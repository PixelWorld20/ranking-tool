# Google USA Rank Checker

## Structure
```
rank-checker/
├── backend/        → FastAPI + Playwright (Railway pe deploy)
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/       → React + Vite (Netlify ya Railway pe deploy)
    ├── src/App.jsx
    ├── package.json
    └── vite.config.js
```

## Railway Backend Deploy

1. GitHub pe repo banao
2. backend/ folder Railway pe deploy karo
3. Railway → New Project → Deploy from GitHub
4. Settings → Region → **US West** select karo (important!)
5. Environment variables:
   - Koi nahi chahiye abhi

## Frontend Deploy (Netlify)

1. frontend/ folder Netlify pe drag & drop karo
2. Environment variable set karo:
   - `VITE_API_URL` = `https://your-backend.railway.app`
3. Build command: `npm run build`
4. Publish dir: `dist`

## Local Test

### Backend:
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python main.py
```

### Frontend:
```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8000
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /check-rank | Rank check job start karo |
| GET | /status/{job_id} | Job status aur result lo |
| GET | /jobs | Saare jobs ki list |
