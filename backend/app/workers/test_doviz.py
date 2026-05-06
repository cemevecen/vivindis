import asyncio
from google_play_scraper import reviews, Sort
import json

async def test():
    pkg = "com.Doviz"
    print(f"Testing package: {pkg}")
    try:
        result, token = reviews(
            pkg,
            lang='tr',
            country='tr',
            sort=Sort.NEWEST,
            count=10
        )
        print(f"Found {len(result)} reviews with original case.")
    except Exception as e:
        print(f"Failed with original case: {e}")

    pkg_low = "com.doviz"
    try:
        result, token = reviews(
            pkg_low,
            lang='tr',
            country='tr',
            sort=Sort.NEWEST,
            count=10
        )
        print(f"Found {len(result)} reviews with lowercase.")
    except Exception as e:
        print(f"Failed with lowercase: {e}")

if __name__ == "__main__":
    asyncio.run(test())
