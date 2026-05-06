from google_play_scraper import Sort, reviews
batch, continuation = reviews(
    'com.spotify.music',
    lang='tr',
    country='tr',
    sort=Sort.NEWEST,
    count=200
)
print("First review date:", batch[0]['at'])
print("Last review date in first batch:", batch[-1]['at'])
