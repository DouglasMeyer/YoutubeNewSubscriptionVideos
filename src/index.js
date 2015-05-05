if (!window.ga) window.ga = function(){};

if (!Array.prototype.find){
  Array.prototype.find = function(fn){
    for (var pair of this){
      if (fn.call(null, pair[1], pair[0], this)) return pair[1];
    }
  };
}

angular.module('YTNew', ['timeRelative'])
.value('notifications', [])
.service('Models', function(gapi){

  ModelJS.NewModelProperties['models'] = {
    get: function(){ return this._models || (this._models = new Map()); }
  };

  function extend(dest){
    var sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function(source){
      if (!source) return;
      Object.keys(source).forEach(function(key){
        dest[key] = source[key];
      });
    });
    return dest;
  }

  ModelJS.NewModelProperties['load'] = {
    value: function(item){
      var Model = this;
      var model = Model.models.get(item.id);
      if (model){
        model.load(item.snippet);
      } else {
        model = new Model(extend({ id: item.id }, item.snippet, item.contentDetails));
        Model.models.set(item.id, model);
      }
      return model;
    }
  };

  ModelJS.NewModelPrototypeProperties['load'] = {
    value: function(props){ extend(this, props); }
  };

  ModelJS.NewModelProperties['find'] = {
    value: function(findOpts){
      var Model = this;

      return gapi
        .request('youtube', this.collectionName, 'list', findOpts)
        .map(Model.load.bind(Model));
    }
  };
  delete ModelJS.NewModelPrototypeProperties['save'];
  delete ModelJS.NewModelPrototypeProperties['destroy'];

  var Subscription = ModelJS();
  Subscription.collectionName = 'subscriptions';

  var Channel = ModelJS();
  Channel.collectionName = 'channels';

  var PlaylistItem = ModelJS();
  PlaylistItem.collectionName = 'playlistItems';

  var Video = ModelJS();
  Video.collectionName = 'videos';
  Object.defineProperty(Video.prototype, 'channelId', {
    enumerable: true,
    get: function(){
      this._channelId;
    },
    set: function(channelId){
      this._channelId = channelId;
      this.channel = Channel.models.get(channelId);
    }
  });

  return {
    Subscription: Subscription,
    Channel: Channel,
    PlaylistItem: PlaylistItem,
    Video: Video
  };
})
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
.factory('getNewSubscriptionVideos', function(gapi, $q, Models){
  var cachedChannels = { expires: Date.now() };

  return function(){
    var deferredSubscriptionVideos = $q.defer(),
        channelStream;
    ga('send', 'event', 'newSubscriptionVideos', 'get');


    function onError(errorResponse, push){
      deferredSubscriptionVideos.reject(errorResponse);
    }

    if (cachedChannels.expires <= Date.now()){
      channelStream = Models.Subscription.find({
        part: 'snippet', mine: true, order: 'unread'
      })
      .map(function(subscription){
        return subscription.resourceId.channelId;
      })
      .batch(50)
      .map(function(channelIds){
        return Models.Channel.find({
          part: 'contentDetails',
          id: channelIds.join(',')
        });
      })
      .parallel(100)
      .flatten()
      .map(function(channel){
        channel.subscription = Array.prototype.find.call(Models.Subscription.models, function(s){
          return s.resourceId.channelId === channel.id;
        });
        return channel;
      })
      .errors(onError);
      channelStream.observe().toArray(function(channels){
        cachedChannels.value = channels;
        cachedChannels.expires = Date.now() + 1000*60 * 60;
      });
    } else {
      channelStream = highland(cachedChannels.value);
    }
    channelStream
    .map(function(channel){
      return Models.PlaylistItem.find({
        part: 'contentDetails',
        playlistId: channel.relatedPlaylists.uploads,
        maxResults: 10
      });
    })
    .parallel(100)
    .flatten()
    .map(function(playlistItem){
      return playlistItem.videoId;
    })
    .filter(function(videoId){
      return Models.Video.models.get(videoId) === undefined;
    })
    .batch(50)
    .map(function(videoIds){
      return Models.Video.find({
        part: 'snippet',
        id: videoIds.join(',')
      });
    })
    .parallel(100)
    .flatten()
    .errors(onError)
    .toArray(deferredSubscriptionVideos.resolve);

    return deferredSubscriptionVideos.promise;
  };
})
.factory('getAuth', function($q, notifications){
  var authPromise, expireTimeout;
  return function(){
    if (authPromise) return authPromise;

    if (expireTimeout) clearTimeout(expireTimeout);
    expireTimeout = undefined;

    authPromise = Pgapi.authorize({
      immediate: true
    }).catch(function(result){
      return Pgapi.authorize();
    }).then(function(result){
      try {
        localStorage.setItem('YTNew.access_token', result.access_token);
      } catch(e){}
      expireTimeout = setTimeout(function(){
        authPromise = undefined;
        expireTimeout = undefined;
      }, parseInt(result.expires_in, 10)*1000);
    }, function(result){
      authPromise = undefined;
      var notification = {
        body: "Could not get autorization. Make sure pop-ups aren't blocked.",
        click: function(){
          var index = notifications.indexOf(notification);
          notifications.splice(index, 1);
        }
      };
      notifications.push(notification);
    });

    return authPromise;
  }
})
.run(function($q, getAuth){
  Pgapi.defer = $q.defer;
  Pgapi.clientId = '699114606672';
  Pgapi.apiKey = 'AIzaSyAxLW9JhtdCuwSNYctaI9VO9iapzU7Jibk';
  Pgapi.load('youtube', { scope: 'https://www.googleapis.com/auth/youtube.readonly' });

  Pgapi.gapiPromise.then(function(){
    try {
      var token = localStorage.getItem('YTNew.access_token');
      gapi.auth.setToken({ access_token: token });
      getAuth();
    } catch (e){ console.error('setToken', e); }
  });

  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
})
.controller('NotificationsCtrl', function($scope, notifications){
  $scope.notifications = notifications;
})
.controller('NewSubscriptionVideos', function($scope, $interval, getAuth, getNewSubscriptionVideos){
  var minute = 1000*60,
      fetchTime = 5*minute,
      notifyNewVideos = [];

  function updateSubscriptionVideos(){
    $scope.nextFetchAt = new Date(Date.now() + fetchTime).toJSON();

    getNewSubscriptionVideos().then(function(newVideos){
      if (!$scope.videos) {
        $scope.videos = newVideos;
      } else if (newVideos.length > 0) {
        Array.prototype.splice.apply($scope.videos, [0, 0].concat(newVideos));
        Array.prototype.splice.apply(notifyNewVideos, [notifyNewVideos.length, 0].concat(newVideos));
        var notification = new Notification(notifyNewVideos.length+" new video"+(notifyNewVideos.length == 1 ? '' : 's'), {
          tag: "new video notification",
          body: "From "+notifyNewVideos.reverse().map(function(v){ return v.channelTitle; }).reduce(function(list, name){ if (list.indexOf(name) == -1){ list.push(name); } return list; }, []).join(', ')
        });
        notification.addEventListener('click', function(){
          notifyNewVideos = [];
        }, false);
      }
    }, function(error){
      return getAuth().then(updateSubscriptionVideos);
    });
  }

  updateSubscriptionVideos();
  $interval(updateSubscriptionVideos, fetchTime);
});
