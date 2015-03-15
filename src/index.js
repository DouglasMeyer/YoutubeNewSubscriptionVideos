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
.factory('getSubscriptions', function(gapi, serviceCache, $q){
  return function(youngerThanMinutes){
    if (!youngerThanMinutes) youngerThanMinutes = 60*24*5;
    var subscriptions = serviceCache.get('subscriptions', youngerThanMinutes);
    if (subscriptions) return $q.when(subscriptions);
    return fetchSubscriptions();
  };

  function fetchSubscriptions(pageToken){
    return gapi.request('youtube', 'subscriptions', 'list', {
      part: 'snippet', mine: true,
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      var subscriptions = response.result.items;

      if(response.result.nextPageToken){
        return fetchSubscriptions(response.result.nextPageToken)
          .then(function(nextSubscriptions){
            return nextSubscriptions.splice.apply(nextSubscriptions, [ 0,0 ].concat(subscriptions));
          });
      } else {
        return subscriptions;
      }
    }, console.error.bind(console, 'subscriptions'))
    .then(function(subscriptions){
      serviceCache.set('subscriptions', subscriptions);
    }, console.error.bind(console, 'subscriptions'));
  }
})
.factory('getSubscriptionVideos', function(gapi, serviceCache, $q, getSubscriptions){
  return function(youngerThanMinutes){
    if (!youngerThanMinutes) youngerThanMinutes = 1;
    var subscriptionVideos = serviceCache.get('subscriptionVideos', youngerThanMinutes);
    if (subscriptionVideos) return $q.when(subscriptionVideos);
    return fetchSubscriptionVideos();
  };

  function fetchSubscriptionVideos(){
    return getSubscriptions()
    .then(function(subscriptions){
      return fetchChannels(subscriptions.map(function(s){ return s.snippet.resourceId.channelId; }));
    })
    .then(function(channels){
      return fetchPlaylistItems(channels.map(function(c){ return c.contentDetails.relatedPlaylists.uploads; }));
    })
    .then(function(playlistItems){
      return fetchVideos(playlistItems.map(function(i){ return i.contentDetails.videoId; }));
    })
    .then(function(videos){
      videos = videos.sort(function(a,b){
        return new Date(a.snippet.publishedAt) > new Date(b.snippet.publishedAt);
      });
      serviceCache.set('subscriptionVideos', videos);
      return videos;
    });
  }

  function fetchChannels(channelIds, pageToken){
    return gapi.request('youtube', 'channels', 'list', {
      part: 'contentDetails',
      id: channelIds.join(','),
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      var channels = response.result.items;

      if(response.result.nextPageToken){
        return fetchChannels(channelIds, response.result.nextPageToken)
          .then(function(nextChannels){
            return nextChannels.splice.apply(nextChannels, [0,0].concat(channels));
          });
      } else {
        return channels;
      }
    });
  }

  function fetchPlaylistItems(playlistIds, pageToken){
    return gapi.request('youtube', 'playlistItems', 'list', {
      part: 'contentDetails',
      playlistId: playlistIds.join(','),
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      var playlistItems = response.result.items;

      if(response.result.nextPageToken){
        return fetchPlaylistItems(playlistIds, response.result.nextPageToken)
          .then(function(nextPlaylistItems){
            return nextPlaylistItems.splice.apply(nextPlaylistItems, [0,0].concat(playlistItems));
          });
      } else {
        return playlistItems;
      }
    });
  }

  function fetchVideos(videoIds, pageToken){
    return gapi.request('youtube', 'videos', 'list', {
      part: 'snippet',
      id: videoIds.join(','),
      maxResults: 50, pageToken: pageToken
    }).then(function(response){
      var videos = response.result.items;

      if(response.result.nextPageToken){
        return fetchVideos(videoIds, response.result.nextPageToken)
          .then(function(nextVideos){
            return nextVideos.splice.apply(nextVideos, [0,0].concat(videos));
          });
      } else {
        return videos;
      }
    });
  }
})
.run(function(){
  Pgapi.clientId = '699114606672';
  Pgapi.apiKey = 'AIzaSyAxLW9JhtdCuwSNYctaI9VO9iapzU7Jibk';
  Pgapi.load('youtube');
})
.controller('SubscriptionsCtrl', function($scope, getSubscriptions){
  getSubscriptions().then(function(subscriptions){
    $scope.subscriptions = subscriptions;
  });
})
.controller('NewSubscriptionVideos', function($scope, getSubscriptionVideos){
  getSubscriptionVideos().then(function(videos){
    $scope.videos = videos;
  });
});
