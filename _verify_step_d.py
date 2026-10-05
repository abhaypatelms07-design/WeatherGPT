import urllib.request, json, time
time.sleep(5)
r = urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=5)
print('HEALTH:', json.loads(r.read()))
