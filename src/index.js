if (!Array.prototype.find){
  Array.prototype.find = function(fn){
    for (var pair of this){
      if (fn.call(null, pair[1], pair[0], this)) return pair[1];
    }
  };
}

angular.module('YTNew', [])
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
.factory('getSubscriptionVideos', function(gapi, $q, Models){
  return function(){
    var deferredSubscriptionVideos = $q.defer();

    Models.Subscription.find({
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
    .parallel(30)
    .flatten()
    .map(function(channel){
      channel.subscription = Array.prototype.find.call(Models.Subscription.models, function(s){
        return s.resourceId.channelId === channel.id;
      });
      return Models.PlaylistItem.find({
        part: 'contentDetails',
        playlistId: channel.relatedPlaylists.uploads,
        maxResults: 10
      });
    })
    .parallel(30)
    .flatten()
    .map(function(playlistItem){
      return playlistItem.videoId;
    })
    .batch(50)
    .map(function(videoIds){
      return Models.Video.find({
        part: 'snippet',
        id: videoIds.join(',')
      });
    })
    .parallel(30)
    .flatten()
    .toArray(deferredSubscriptionVideos.resolve);

    return deferredSubscriptionVideos.promise;
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
.controller('NewSubscriptionVideos', function($scope, getSubscriptionVideos){
  function updateSubscriptionVideos(){
    getSubscriptionVideos().then(function(videos){
      $scope.videos = videos;
    });
  }

  updateSubscriptionVideos();
  var minute = 1000*60;
  setInterval(updateSubscriptionVideos, 5*minute);
});
