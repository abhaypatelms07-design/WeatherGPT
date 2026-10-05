import urllib.request, json
try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/api/weather?latitude=28.61&longitude=77.23', timeout=25)
    d = json.loads(r.read())
    print('WEATHER STATUS: 200 OK')
    for k in ['location','temperature','feels_like','humidity','wind_speed','rain_probability','condition','latitude','longitude']:
        print(f'  {k}: {d.get(k)}')
except urllib.error.HTTPError as e:
    body = e.read()
    try:
        detail = json.loads(body).get('detail', body.decode()[:100])
    except Exception:
        detail = body.decode()[:100]
    print(f'WEATHER STATUS: {e.code}')
    print('detail:', detail)
except Exception as ex:
    print('WEATHER ERROR:', type(ex).__name__, str(ex)[:150])
