if (!Array.prototype.find){
  Array.prototype.find = function(fn){
    var value;
    for (var i=0; i < this.length; i++){
      value = this[i];
      if (fn.call(null, value, i, this)) return value;
    }
  };
}

angular.module('YTNew', [])
.value('notifications', [])
.service('gapi', function($q){
  //this.authorize = function(){
  //  return $q.when( Pgapi.authorize.apply(Pgapi, arguments) );
  //};
  this.request = function(){
    var requestArgs = arguments;
    return highland(function(push, next){
      Pgapi.request.apply(Pgapi, requestArgs)
        .then(function(){
          push(null, highland.nil);
        }, function(err){
          push(err);
          push(null, highland.nil);
        }, function(result){
          result.items.forEach(function(item){
            push(null, item);
          });
        });
    });
  };
})
.service('serviceCache', function(){

  this.get = function(service, expiresMinutes){
    var cache;
    var fetchDate = localStorage.getItem('YTNew.'+service+'.fetchDate');
    var isCacheFresh = fetchDate && new Date(fetchDate).getTime() > new Date() - 1000*60*expiresMinutes;
    try {
      if (isCacheFresh) {
        cache = angular.fromJson(localStorage.getItem('YTNew.'+service));
      } else {
        localStorage.removeItem('YTNew.'+service+'.fetchDate');
        localStorage.removeItem('YTNew.'+service);
      }
    } catch(e){ }
    return cache;
  };

  this.set = function(service, value){
    try {
      localStorage.setItem('YTNew.'+service+'.fetchDate', new Date());
      localStorage.setItem('YTNew.'+service, angular.toJson(value));
    } catch(e){
      console.error('subscriptions', service, e.stack);
    }
  };
})
.factory('getSubscriptions', function(gapi, serviceCache, $q){
  var subscriptions;
  return function(youngerThanMinutes){
    if (subscriptions) return subscriptions.fork();
    if (youngerThanMinutes === undefined) youngerThanMinutes = 60*24*5;
    subscriptions = serviceCache.get('subscriptions', youngerThanMinutes);
    if (subscriptions) {
      subscriptions = highland(subscriptions);
      return subscriptions.fork();
    }
    subscriptions = gapi.request('youtube', 'subscriptions', 'list', {
      part: 'snippet', mine: true, order: 'unread'
    });
    subscriptions.fork().toArray(function(s){
      subscriptions = null;
      serviceCache.set('subscriptions', s);
    });
    return subscriptions.fork();
  };
})
.factory('getSubscriptionVideos', function(gapi, serviceCache, $q, getSubscriptions){
  var subscriptionVideos;
  return function(youngerThanMinutes){
    if (subscriptionVideos) return subscriptionVideos.fork();
    if (youngerThanMinutes === undefined) youngerThanMinutes = 2;
    subscriptionVideos = serviceCache.get('subscriptionVideos', youngerThanMinutes);
    if (subscriptionVideos) {
      subscriptionVideos = highland(subscriptionVideos)
      return subscriptionVideos;
    }
    subscriptionVideos = getSubscriptions()
      .map(function(subscription){
        return subscription.snippet.resourceId.channelId;
      })
      .batch(50)
      .map(function(channelIds){
        return gapi.request('youtube', 'channels', 'list', {
          part: 'contentDetails',
          id: channelIds.join(',')
        });
      })
      .parallel(30)
      .flatten()
      .map(function(channel){
        return gapi.request('youtube', 'playlistItems', 'list', {
          part: 'contentDetails',
          playlistId: channel.contentDetails.relatedPlaylists.uploads,
          maxResults: 10
        });
      })
      .parallel(30)
      .flatten()
      .map(function(playlistItem){
        return playlistItem.contentDetails.videoId;
      })
      .batch(50)
      .map(function(videoIds){
        return gapi.request('youtube', 'videos', 'list', {
          part: 'snippet',
          id: videoIds.join(',')
        });
      })
      .parallel(30)
      .flatten();
    subscriptionVideos.fork().toArray(function(s){
      subscriptionVideos = null;
      serviceCache.set('subscriptionVideos', s);
    });
    return subscriptionVideos.fork();
  };
})
.run(function($q, notifications){
  Pgapi.defer = $q.defer;
  Pgapi.clientId = '699114606672';
  Pgapi.apiKey = 'AIzaSyAxLW9JhtdCuwSNYctaI9VO9iapzU7Jibk';
  Pgapi.load('youtube', { scope: 'https://www.googleapis.com/auth/youtube.readonly' });

  Pgapi.authorize({
    immediate: true
  }).catch(function(result){
    return Pgapi.authorize();
  }).then(function(result){
    console.log('auth', result, new Date(result.expires_at*1000));
  }, function(result){
    var notification = {
      body: "Could not get autorization. Make sure pop-ups aren't blocked.",
      click: function(){
        var index = notifications.indexOf(notification);
        notifications.splice(index, 1);
      }
    };
    notifications.push(notification);
  });
})
.controller('NotificationsCtrl', function($scope, notifications){
  $scope.notifications = notifications;
})
.controller('SubscriptionsCtrl', function($scope, getSubscriptions){
  getSubscriptions().toArray(function(subscriptions){
    $scope.subscriptions = subscriptions;
  });
})
.controller('NewSubscriptionVideos', function($scope, getSubscriptions, getSubscriptionVideos){
  var gs = getSubscriptions(),
      gv = getSubscriptionVideos();
  gs.toArray(function(subscriptions){
    gv.map(function(video){
      video.subscription = subscriptions.find(function(sub){
        return sub.snippet.resourceId.channelId === video.snippet.channelId;
      });
      return video;
    }).toArray(function(videos){
      $scope.videos = videos;
    });
  });
});
