Pgapi.authorize({
  immediate: true
}).catch(function(result){
  console.error('auth', result);
  return Pgapi.authorize();
}).then(function(result){
  console.log('auth', result, new Date(result.expires_at*1000));
}, console.error.bind(console, 'auth'));

angular.module('YTNew', [])
.service('gapi', function($q){
  //this.authorize = function(){
  //  return $q.when( Pgapi.authorize.apply(Pgapi, arguments) );
  //};
  this.request = function(){
    return $q.when( Pgapi.request.apply(Pgapi, arguments) );
  };
})
.service('serviceCache', function(){

  this.get = function(service, expiresMinutes){
    var cache;
    try {
      var fetchDate = localStorage.getItem('YTNew.'+service+'.fetchDate');
      if (fetchDate && new Date(fetchDate) > new Date() - 1000*60*expiresMinutes) {
        cache = angular.fromJson(localStorage.getItem('YTNew.'+service));
      } else {
        localStorage.removeItem('YTNew.'+service+'.fetchDate');
        localStorage.removeItem('YTNew.'+service);
      }
    } catch(e){
      console.error('serviceCache', service, e);
    }
    return cache;
  };

  this.set = function(service, value){
    try {
      localStorage.setItem('YTNew.'+service+'.fetchDate', new Date());
      localStorage.setItem('YTNew.'+service, angular.toJson(value));
    } catch(e){
      console.error('subscriptions', e);
    }
  };
})
.factory('subscriptions', function(gapi, serviceCache){
  var subscriptions = serviceCache.get('subscriptions', 60*24*5);

  if (!subscriptions) {
    subscriptions = [];
    fetchSubscriptions();
  }

  return subscriptions;

  function fetchSubscriptions(pageToken){
    gapi.request('youtube', 'subscriptions', 'list', {
      part: 'snippet', mine: true,
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      subscriptions.splice.apply(subscriptions, [subscriptions.length, 0].concat(response.result.items) );

      if(response.result.nextPageToken){
        fetchSubscriptions(response.result.nextPageToken);
      } else {
        serviceCache.set('subscriptions', subscriptions);
      }
    }, console.error.bind(console, 'subscriptions'));
  }
})
.run(function(){
  Pgapi.clientId = '699114606672';
  Pgapi.apiKey = 'AIzaSyAxLW9JhtdCuwSNYctaI9VO9iapzU7Jibk';
  Pgapi.load('youtube');
})
.controller('SubscriptionsCtrl', function($scope, subscriptions){
  $scope.subscriptions = subscriptions;
});
