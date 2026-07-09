"""
Rank Checker - FastAPI Backend
Railway Deploy Ready
"""

import asyncio
import random
import uuid
from datetime import datetime
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Rank Checker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store
jobs = {}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class CheckRequest(BaseModel):
    site: str
    keyword: str
    max_pages: Optional[int] = 10


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Rank Checker API running", "time": datetime.now().isoformat()}


@app.post("/check-rank")
async def check_rank(req: CheckRequest):
    """Start a rank check job — returns job_id"""
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "id": job_id,
        "site": req.site,
        "keyword": req.keyword,
        "max_pages": req.max_pages,
        "status": "running",
        "progress": "Starting...",
        "result": None,
        "started_at": datetime.now().isoformat(),
    }
    # Background mein run karo
    asyncio.create_task(run_rank_check(job_id, req.site, req.keyword, req.max_pages))
    return {"job_id": job_id, "message": "Job started"}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    """Job status aur result lo"""
    if job_id not in jobs:
        return {"error": "Job not found"}
    return jobs[job_id]


@app.get("/jobs")
def list_jobs():
    """Saare jobs ki list"""
    return list(jobs.values())


# ─── PLAYWRIGHT RANK CHECK ────────────────────────────────────────────────────

async def extract_results(page) -> list:
    results = []
    try:
        links = await page.query_selector_all("a[href]")
        for link in links:
            try:
                href = await link.get_attribute("href")
                if not href or not href.startswith("http"):
                    continue
                skip = ["google.com", "google.co", "youtube.com", "accounts.google",
                        "support.google", "maps.google", "play.google", "policies.google"]
                if any(s in href for s in skip):
                    continue
                title = "N/A"
                try:
                    h3 = await link.query_selector("h3")
                    if not h3:
                        parent = await link.evaluate_handle("el => el.closest('div')")
                        h3 = await parent.query_selector("h3")
                    if h3:
                        title = await h3.inner_text()
                except Exception:
                    pass
                if title != "N/A" and title.strip():
                    results.append({"href": href, "title": title.strip()})
            except Exception:
                continue
    except Exception:
        pass

    seen = set()
    unique = []
    for r in results:
        if r["href"] not in seen:
            seen.add(r["href"])
            unique.append(r)
    return unique


async def run_rank_check(job_id: str, site: str, keyword: str, max_pages: int):
    from playwright.async_api import async_playwright

    job = jobs[job_id]

    try:
        async with async_playwright() as p:
            job["progress"] = "Browser launch ho raha hai..."
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled",
                      "--disable-dev-shm-usage", "--disable-gpu"],
            )

            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1366, "height": 768},
                locale="en-US",
                timezone_id="America/New_York",
                geolocation={"latitude": 40.7128, "longitude": -74.0060},
                permissions=["geolocation"],
            )

            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
            """)

            page = await context.new_page()
            job["progress"] = "Google USA open ho raha hai..."

            search_url = (
                f"https://www.google.com/search"
                f"?q={keyword.replace(' ', '+')}"
                f"&gl=us&hl=en&num=10&pws=0"
            )

            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(random.uniform(3, 5))

            overall_rank = 0
            found = False

            for page_num in range(1, max_pages + 1):
                job["progress"] = f"Page {page_num}/{max_pages} scan ho raha hai... (total scanned: {overall_rank})"

                if page_num > 1:
                    try:
                        next_btn = (
                            await page.query_selector("a#pnnext") or
                            await page.query_selector("a[aria-label='Next page']")
                        )
                        if not next_btn:
                            break
                        await next_btn.click()
                        await asyncio.sleep(random.uniform(3, 5))
                    except Exception:
                        break

                items = await extract_results(page)
                page_rank = 0

                for item in items:
                    page_rank    += 1
                    overall_rank += 1

                    if site.lower() in item["href"].lower():
                        job["status"]   = "done"
                        job["progress"] = "Completed"
                        job["result"]   = {
                            "found":    True,
                            "rank":     overall_rank,
                            "page":     page_num,
                            "position": page_rank,
                            "url":      item["href"],
                            "title":    item["title"],
                            "total_scanned": overall_rank,
                        }
                        found = True
                        break

                if found:
                    break

                await asyncio.sleep(random.uniform(2, 4))

            await browser.close()

            if not found:
                job["status"]   = "done"
                job["progress"] = "Completed"
                job["result"]   = {
                    "found":         False,
                    "rank":          None,
                    "total_scanned": overall_rank,
                    "message":       f"Top {overall_rank} results mein nahi mila"
                }

    except Exception as e:
        job["status"]   = "error"
        job["progress"] = f"Error: {str(e)}"
        job["result"]   = {"found": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
