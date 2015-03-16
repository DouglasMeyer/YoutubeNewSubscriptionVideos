(function(){

  window.Pgapi = {
    clientId: null,
    apiKey: null
  };

  var scopes=[],
      gapiDefer = Promise.defer(),
      authDefer = Promise.defer();

  Pgapi.authorize = function(options){
    return gapiDefer.promise.then(function(){
      return new Promise(function(resolve, reject){
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
            resolve(authResult);
          } else {
            reject(authResult);
          }
        });
      });
    });
  };

  Pgapi.request = function(service, collection, action, options){
    return services[service].defer.promise.then(function(){
      var maxResults = options.maxResults;
      if (!maxResults || maxResults > 50) options.maxResults = 50;

      return gapi.client[service][collection][action](options)
        .then(function(response){
          if (response.result.nextPageToken && (!maxResults || maxResults > 50)){
            if (maxResults) options.maxResults = maxResults - 50;
            options.pageToken = response.result.nextPageToken;
            return Pgapi.request(service, collection, action, options)
              .then(function(nextResponse){
                var items = nextResponse.result.items;
                Array.prototype.splice.apply(items, [items.length,0].concat(response.result.items));
                return nextResponse;
              });
          } else {
            return response;
          }
        });
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
    version: 'v3',
    defer: Promise.defer()
  };
  services['drive'] = {
    scope: 'https://www.googleapis.com/auth/drive',
    version: 'v2',
    defer: Promise.defer()
  };

  Pgapi.load = function(serviceName, options){
    var service = services[serviceName];
    if (!options) options = {};
    if (!service) throw 'No service named"'+serviceName+'"';

    scopes.push( options.scope || service.scope );
    authDefer.promise.then(function(){
      gapi.client.load(serviceName, options.version || service.version, function(){
        service.defer.resolve();
      });
    });
  };

}());
