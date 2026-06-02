/* VH1 Camp service worker
 * Caches the shell + receives Web Push events.
 * Tapping the notification focuses (or opens) the portal.
 */

const CACHE='vh1-camp-v12';
const ASSETS=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

self.addEventListener('push',(event)=>{
  let data={};
  try{
    data=event.data?event.data.json():{};
  }catch(err){
    data={title:'VH1 Camp',body:event.data?event.data.text():''};
  }

  // Resolve icons + click-through URL relative to SW scope so they
  // work whether the app is hosted at /portal/ on GitHub Pages or
  // at the root on Netlify. An absolute "/" in the payload would
  // otherwise dump users at the GitHub Pages org apex (404).
  const scope=self.registration.scope;
  const isAppRoot=(v)=>!v||v==='/'||v==='./';
  const resolve=(val,fallback)=>{
    if(isAppRoot(val))return isAppRoot(fallback)?scope:new URL(fallback,scope).href;
    try{return new URL(val,scope).href;}catch(e){return scope;}
  };

  const title=data.title||'VH1 Camp';
  const options={
    body:data.body||'',
    icon:resolve(data.icon,'icon-192.png'),
    badge:resolve(data.badge,'icon-192.png'),
    tag:data.tag||'vh1-camp',
    renotify:true,
    vibrate:[200,100,200],
    data:{url:resolve(data.url,'')},
  };

  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  const scope=self.registration.scope;
  const targetUrl=(event.notification.data&&event.notification.data.url)||scope;
  event.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then((wins)=>{
      // Focus an already-open VH1 tab under our scope. Match by scope
      // prefix so we don't grab an unrelated tab on the same origin.
      for(const w of wins){
        if(w.url&&w.url.indexOf(scope)===0&&'focus' in w){
          if('navigate' in w&&w.url!==targetUrl){
            return w.navigate(targetUrl).then(()=>w.focus()).catch(()=>w.focus());
          }
          return w.focus();
        }
      }
      if(self.clients.openWindow)return self.clients.openWindow(targetUrl);
    })
  );
});
