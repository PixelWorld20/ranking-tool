"""
Google Rank Checker - FastAPI Backend
Multiple Keywords + Retry Logic
"""

import asyncio
import random
import uuid
import os
from datetime import datetime
from typing import List, Optional
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

jobs = {}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class CheckRequest(BaseModel):
    site: str
    keywords: List[str]
    max_pages: Optional[int] = 10


@app.get("/")
def root():
    return {"status": "Rank Checker API running", "time": datetime.now().isoformat()}


@app.post("/check-rank")
async def check_rank(req: CheckRequest):
    job_id = str(uuid.uuid4())[:8]
    keywords = [k.strip() for k in req.keywords if k.strip()]
    jobs[job_id] = {
        "id": job_id,
        "site": req.site,
        "keywords": keywords,
        "max_pages": req.max_pages,
        "status": "running",
        "progress": "Starting...",
        "current_keyword": "",
        "current_keyword_index": 0,
        "total_keywords": len(keywords),
        "results": [],
        "started_at": datetime.now().isoformat(),
    }
    asyncio.create_task(run_rank_check(job_id, req.site, keywords, req.max_pages))
    return {"job_id": job_id, "message": "Job started", "total_keywords": len(keywords)}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    if job_id not in jobs:
        return {"error": "Job not found"}
    return jobs[job_id]


@app.get("/jobs")
def list_jobs():
    return list(jobs.values())


# ─── EXTRACTION ───────────────────────────────────────────────────────────────

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
                        "support.google", "maps.google", "play.google", "policies.google",
                        "webcache.google", "translate.google"]
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


async def is_captcha_page(page) -> bool:
    """Check karo CAPTCHA ya block page hai"""
    try:
        content = await page.content()
        title = await page.title()
        return (
            "unusual traffic" in content.lower() or
            "recaptcha" in content.lower() or
            "captcha" in content.lower() or
            "blocked" in title.lower() or
            "sorry" in title.lower()
        )
    except Exception:
        return False


async def check_single_keyword(page, site: str, keyword: str, max_pages: int, job: dict) -> dict:
    result = {
        "keyword": keyword,
        "rank": None,
        "page": None,
        "position": None,
        "url": None,
        "title": None,
        "total_scanned": 0,
        "status": "Not Found",
        "found": False,
    }

    MAX_RETRIES = 2

    for attempt in range(MAX_RETRIES):
        try:
            if attempt > 0:
                job["progress"] = f"[{keyword}] Retry {attempt}/{MAX_RETRIES-1} — thoda wait kar raha hoon..."
                await asyncio.sleep(random.uniform(8, 12))

            search_url = (
                f"https://www.google.com/search"
                f"?q={keyword.replace(' ', '+')}"
                f"&gl=us&hl=en&num=10&pws=0"
            )

            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(random.uniform(4, 6))

            # CAPTCHA check
            if await is_captcha_page(page):
                job["progress"] = f"[{keyword}] CAPTCHA detected — wait karke retry kar raha hoon..."
                await asyncio.sleep(random.uniform(10, 15))
                # Dusre URL se try karo
                await page.goto("https://www.google.com", wait_until="domcontentloaded")
                await asyncio.sleep(random.uniform(3, 5))
                await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(random.uniform(4, 6))

            overall_rank = 0
            found_this_attempt = False

            for page_num in range(1, max_pages + 1):
                job["progress"] = f"[{keyword}] Page {page_num}/{max_pages} scan ho raha hai... (scanned: {overall_rank})"

                if page_num > 1:
                    try:
                        next_btn = (
                            await page.query_selector("a#pnnext") or
                            await page.query_selector("a[aria-label='Next page']") or
                            await page.query_selector("a[aria-label='Next']")
                        )
                        if not next_btn:
                            break
                        await next_btn.click()
                        await asyncio.sleep(random.uniform(3, 5))

                        if await is_captcha_page(page):
                            job["progress"] = f"[{keyword}] CAPTCHA on page {page_num} — stopping"
                            break

                    except Exception:
                        break

                items = await extract_results(page)

                # Agar 0 results aaye — page properly load nahi hua
                if not items and page_num == 1:
                    job["progress"] = f"[{keyword}] 0 results on page 1 — retrying..."
                    break

                page_rank = 0
                for item in items:
                    page_rank    += 1
                    overall_rank += 1

                    if site.lower() in item["href"].lower():
                        result.update({
                            "rank":          overall_rank,
                            "page":          page_num,
                            "position":      page_rank,
                            "url":           item["href"],
                            "title":         item["title"],
                            "total_scanned": overall_rank,
                            "status":        "Found",
                            "found":         True,
                        })
                        found_this_attempt = True
                        break

                if found_this_attempt:
                    return result

                result["total_scanned"] = overall_rank
                await asyncio.sleep(random.uniform(2, 4))

            # Agar results mile the (bhale hi site nahi mili) — retry mat karo
            if overall_rank > 0:
                result["status"] = f"Not Found (checked {overall_rank})"
                return result

        except Exception as e:
            result["status"] = f"Error: {str(e)}"
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(random.uniform(5, 8))

    return result


async def run_rank_check(job_id: str, site: str, keywords: list, max_pages: int):
    from playwright.async_api import async_playwright

    job = jobs[job_id]

    try:
        async with async_playwright() as p:
            job["progress"] = "Browser launch ho raha hai..."
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--window-size=1366,768",
                ],
            )

            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1366, "height": 768},
                locale="en-US",
                timezone_id="America/New_York",
                geolocation={"latitude": 40.7128, "longitude": -74.0060},
                permissions=["geolocation"],
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                }
            )

            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            """)

            page = await context.new_page()

            # Pehle Google home kholo — natural lagta hai
            job["progress"] = "Google USA open ho raha hai..."
            await page.goto("https://www.google.com", wait_until="domcontentloaded")
            await asyncio.sleep(random.uniform(2, 4))

            for i, keyword in enumerate(keywords):
                job["current_keyword"]       = keyword
                job["current_keyword_index"] = i + 1
                job["progress"]              = f"Keyword {i+1}/{len(keywords)}: '{keyword}' check ho raha hai..."

                result = await check_single_keyword(page, site, keyword, max_pages, job)
                job["results"].append(result)

                # Keywords ke beech delay — last keyword ke baad nahi
                if i < len(keywords) - 1:
                    wait = random.uniform(6, 10)
                    job["progress"] = f"Next keyword se pehle {wait:.0f}s wait..."
                    await asyncio.sleep(wait)

            await browser.close()

            job["status"]          = "done"
            job["progress"]        = "Completed"
            job["current_keyword"] = ""

    except Exception as e:
        job["status"]   = "error"
        job["progress"] = f"Error: {str(e)}"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
