import asyncio, sys
sys.stdout.reconfigure(encoding="utf-8")
import httpx

BASE = "http://localhost:8006"

async def main():
    async with httpx.AsyncClient(base_url=BASE) as c:
        r = await c.post("/api/auth/login", data={
            "username": "uvtest@example.com", "password": "TestPass@123"
        })
        t = r.json().get("access_token")
        h = {"Authorization": f"Bearer {t}"}

        # Complete 2 lessons in the python track (module 1) to simulate partial progress,
        # and then complete ALL lessons in python track to reach 'completed'.
        py = (await c.get("/api/lessons/languages/python", headers=h)).json()
        lesson_ids = [le["id"] for m in py["modules"] for le in m["lessons"]]
        print("python track has", len(lesson_ids), "lesson ids:", lesson_ids)

        # First complete just the first 2 to test 'in-progress'
        for lid in lesson_ids[:2]:
            await c.post("/api/lessons/complete-lesson",
                json={"lesson_id": lid, "score": 100, "time_spent": 60, "attempts": 1}, headers=h)

        rp = await c.get("/api/roadmap/ai-engineer", headers=h)
        tr = next(x for x in rp.json()["tracks"] if x["slug"] == "python")
        print("after 2 lessons:", tr["status"], tr["completed_lessons"], "/", tr["total_lessons"])
        print("overall:", rp.json()["percent"], "%")

        # Now complete ALL python lessons -> completed
        for lid in lesson_ids[2:]:
            await c.post("/api/lessons/complete-lesson",
                json={"lesson_id": lid, "score": 100, "time_spent": 30, "attempts": 1}, headers=h)

        rp2 = await c.get("/api/roadmap/ai-engineer", headers=h)
        tr2 = next(x for x in rp2.json()["tracks"] if x["slug"] == "python")
        print("after ALL python lessons:", tr2["status"], tr2["completed_lessons"], "/", tr2["total_lessons"])
        print("overall:", rp2.json()["percent"], "%")

asyncio.run(main())
