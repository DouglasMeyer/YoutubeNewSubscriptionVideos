(function(){

  window.Pgapi = {
    clientId: null,
    apiKey: null,
    defer: Promise.defer.bind(Promise)
  };

  var scopes=[],
      gapiDefer = Pgapi.defer(),
      authDefer = Pgapi.defer();
  Pgapi.gapiPromise = gapiDefer.promise;

  Pgapi.authorize = function(options){
    if (!options) options = {};
    return gapiDefer.promise.then(function(){
      var deferAuth = Pgapi.defer();

      gapi.auth.authorize({
        client_id: Pgapi.clientId,
        scope: scopes.join(','),
        immediate: options.immediate || false
      }, function(authResult){
        if (authResult && !authResult.error){
          if (authDefer){
            authDefer.resolve(authResult);
            authDefer = null;
          }
          deferAuth.resolve(authResult);
        } else {
          deferAuth.reject(authResult);
        }
      });

      return deferAuth.promise;
    });
  };

  Pgapi.request = function(serviceName, collection, action, options){
    var service = services[serviceName];
    if (!service.defer) service.defer = Pgapi.defer();
    return service.defer.promise.then(function(){
      var maxResults = options.maxResults;
      if (!maxResults || maxResults > 50) options.maxResults = 50;

      var deferredRequest = Pgapi.defer();
      gapi.client[serviceName][collection][action](options).then(function(response){
        if (deferredRequest.notify) deferredRequest.notify(response.result);

        if (response.result.nextPageToken && (!maxResults || maxResults > 50)){
          if (maxResults) options.maxResults = maxResults - 50;
          options.pageToken = response.result.nextPageToken;
          Pgapi.request(serviceName, collection, action, options)
            .then(function(nextResponse){
              if (deferredRequest.notify) deferredRequest.notify(nextResponse.result);
              deferredRequest.resolve({
                etag: nextResponse.result.etag,
                items: response.result.items.concat(nextResponse.result.items),
                kind: nextResponse.result.kind,
                pageInfo: nextResponse.result.pageInfo
              });
            });
        } else {
          deferredRequest.resolve(response);
        }
      }, deferredRequest.reject);
      return deferredRequest.promise;
    });
  };

  document.addEventListener("DOMContentLoaded", function(){
    var script = document.createElement('script');
    var callbackName = '_Pgapi_clientLoadedCallback';
    script.src = 'https://apis.google.com/js/client.js?onload='+callbackName;
    window[callbackName] = function(){ gapiDefer.resolve(); };
    document.body.appendChild(script);
  }, false);

  var services = {};
  services['youtube'] = {
    scope: 'https://www.googleapis.com/auth/youtube',
    version: 'v3'
  };
  services['drive'] = {
    scope: 'https://www.googleapis.com/auth/drive',
    version: 'v2'
  };

  Pgapi.load = function(serviceName, options){
    var service = services[serviceName];
    if (!options) options = {};
    if (!service) throw 'No service named"'+serviceName+'"';

    if (!service.defer) service.defer = Pgapi.defer();
    scopes.push( options.scope || service.scope );
    authDefer.promise.then(function(){
      gapi.client.load(serviceName, options.version || service.version, service.defer.resolve);
    });
  };

}());
