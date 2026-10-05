import urllib.request, json
body = json.dumps({'message':'Will it rain today?','latitude':28.61,'longitude':77.23,'language':'en','mode':'general'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/chat',
    data=body,
    headers={'Content-Type':'application/json'},
    method='POST'
)
try:
    r = urllib.request.urlopen(req, timeout=35)
    d = json.loads(r.read())
    print('CHAT STATUS: 200')
    print('location:', d.get('location'))
    print('answer:', d.get('answer','')[:200])
except urllib.error.HTTPError as e:
    try:
        detail = json.loads(e.read()).get('detail','')
    except Exception:
        detail = ''
    print(f'CHAT STATUS: {e.code}', detail)
except Exception as ex:
    print('CHAT ERROR:', str(ex)[:200])
