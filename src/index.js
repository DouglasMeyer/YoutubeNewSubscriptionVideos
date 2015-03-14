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
.factory('subscriptions', function(gapi){
  var subscriptions = {};
  try {
    subscriptions = angular.fromJson(localStorage.getItem('YTNew.subscriptions'));
  } catch(e){
    console.error('subscriptions', e);
  }
  if (!subscriptions || !subscriptions.all) subscriptions = { all: [] };

  function fetchSubscriptions(pageToken){
    gapi.request('youtube', 'subscriptions', 'list', {
      part: 'snippet', mine: true,
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      subscriptions.all.splice.apply(subscriptions.all, [subscriptions.all.length, 0].concat(response.result.items) );

      if(response.result.nextPageToken){
        fetchSubscriptions(response.result.nextPageToken);
      } else {
        try {
          subscriptions.fetchDate = new Date();
          localStorage.setItem('YTNew.subscriptions', angular.toJson(subscriptions));
        } catch(e){
          console.error('subscriptions', e);
        }
      }
    }, console.error.bind(console, 'subscriptions'));
  }

  if (!subscriptions.fetchDate || new Date(subscriptions.fetchDate) < new Date() - 1000*60*60*24*5) {
    fetchSubscriptions();
  }

  return subscriptions.all;
})
.run(function(){
  Pgapi.clientId = '699114606672';
  Pgapi.apiKey = 'AIzaSyAxLW9JhtdCuwSNYctaI9VO9iapzU7Jibk';
  Pgapi.load('youtube');
})
.controller('SubscriptionsCtrl', function($scope, subscriptions){
  $scope.subscriptions = subscriptions;
});
