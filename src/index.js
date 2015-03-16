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
      if (fetchDate && new Date(fetchDate).getTime() > new Date() - 1000*60*expiresMinutes) {
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
    return fetchSubscriptions()
      .then(function(subscriptions){
        serviceCache.set('subscriptions', subscriptions);
        return subscriptions;
      }, console.error.bind(console, 'subscriptions'));
  };

  function fetchSubscriptions(){
    return gapi.request('youtube', 'subscriptions', 'list', {
      part: 'snippet', mine: true
    }).then(function(response){
      return response.result.items;
    }, console.error.bind(console, 'subscriptions'));
  }
})
.factory('getSubscriptionVideos', function(gapi, serviceCache, $q, getSubscriptions){
  return function(youngerThanMinutes){
    if (!youngerThanMinutes) youngerThanMinutes = 2;
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
      var playlistIds = channels.map(function(c){ return c.contentDetails.relatedPlaylists.uploads; });
      var latestFetch = $q.when( [] );
      playlistIds.forEach(function(playlistId){
        latestFetch = latestFetch.then(function(playlistItems){
          return fetchPlaylistItems(playlistId, 10).then(function(nextPlaylistItems){
            return playlistItems.concat(nextPlaylistItems);
          });
        });
      });
      return latestFetch;
    })
    .then(function(playlistItems){
      playlistItems = playlistItems
      .filter(function(i){
        return i.kind == 'youtube#playlistItem';
      })
      .sort(function(a,b){
        return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
      });
      return fetchVideos(playlistItems.slice(0,50).map(function(i){ return i.contentDetails.videoId; }));
    })
    .then(function(videos){
      videos = videos.sort(function(a,b){
        return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
      });
      serviceCache.set('subscriptionVideos', videos);
      return videos;
    });
  }

  function fetchChannels(channelIds){
    return gapi.request('youtube', 'channels', 'list', {
      part: 'contentDetails',
      id: channelIds.splice(0,50).join(',')
    }).then(function(response){
      var channels = response.result.items;
      if (channelIds.length){
        return fetchChannels(channelIds)
          .then(function(nextChannels){
            return channels.concat(nextChannels);
          });
      } else {
        return channels;
      }
    });
  }

  function fetchPlaylistItems(playlistIds, maxItems){
    return gapi.request('youtube', 'playlistItems', 'list', {
      part: 'contentDetails,snippet',
      playlistId: playlistIds,
      maxResults: maxItems
    }).then(function(response){
      return response.result.items;
    });
  }

  function fetchVideos(videoIds){
    return gapi.request('youtube', 'videos', 'list', {
      part: 'snippet',
      id: videoIds.join(',')
    }).then(function(response){
      return response.result.items;
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
