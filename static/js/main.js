$(function($){
  
  var body = $(document.body), location = window.location, 
      history = window.history, console = window.console || {"log":function(){}};

  $.fn.knm = function(callback, code) {
    if(code === undefined) code = "38,38,40,40,37,39,37,39,66,65";
    return this.each(function() {
      var kkeys = [];
      $(this).keydown(function(e){
        kkeys.push( e.keyCode );
        if ( kkeys.toString().indexOf( code ) >= 0 ){
          $(this).unbind('keydown', arguments.callee);
          callback(e);
        }
      }, true);
    });
  };

  // konami code
  $(window).knm(function(){
    if(console.log){
      console.log("u've hit the magic keys");
    }
  });
  
  var x=1, y=1, outer = $("#outer");
  var map = {
    "about-event": "p00",
    "about-hasgeek": "p01",
    "proposals": "p02",
    "venue": "p10",
    "home": "p11",
    "videos": "p12",
    "sponsors": "p20",
    "credits": "p21",
    "register": "p22"
  }, requested = location.hash || location.pathname.substr(1);
  
  if(typeof map[requested] !== 'undefined'){
    body.attr("class", requested + " " + map[requested]);
  } else {
    body.attr("class", "p"+y+x);
  }
  
  var template = $("#template");
  var rendered = $("#rendered");
  function adjust(){
    var w = body.width(), h = body.height();
    if(w < 1000){ w = 1000; }
    if(h < 700){ h = 700; }
    rendered.empty().text(template.html().replace(/\{w\}/g,w+"px").replace(/\{h\}/g,h+"px"));
  }
  adjust();
  $(window).resize(adjust);

  body.attr("style","display:block");
  
  
  var historyAPISupported = !!(history && history.pushState);
  var hashChangeSupported = !!("onhashchange" in window);
  var animTimer;

  function updateURL(url, e){
   if(typeof map[url] !== 'undefined'){
      outer.addClass("animated");
      body.attr("class", url + " " + map[url]);
      clearTimeout(animTimer);
      animTimer = setTimeout(function(){
        outer.removeClass("animated");
      },600);
      if(_gaq instanceof Array){
        _gaq.push(['_trackPageview', url]);
      }
      if(e){
        e.preventDefault();
      }
    }
  }

  $("header a").live("click",function(e){
    var url = this.href.substr(this.href.lastIndexOf("/")+1);
    if(url === location.pathname.substr(1)){
      return e.preventDefault();
    }
    if(typeof map[url] !== 'undefined'){
      if(historyAPISupported){
        history.pushState(null, null, "/"+url);
      }else if(hashChangeSupported){
        location.hash = url;
      }else{
        return;
      }
    }
    updateURL(url, e);
    $(this).blur();
  });

  if(historyAPISupported){
    $(window).bind("popstate", function(e){
      var url = location.pathname.substr(1);
      updateURL(url);
    });
  }else if(hashChangeSupported){
    $(window).bind( 'hashchange', function(e){
      var url = location.hash.substr(1);
      updateURL(url);
    });
  }
  
  // maps
  setTimeout(function fetchMap(){
    var styles = [{ featureType: "all", elementType: "all", stylers: [{hue: '#eecc70'}, { saturation: -70 }, { gamma: 0.70 }]}];
    var retroMapType = new google.maps.StyledMapType(styles, {});
    var dharmaram = new google.maps.LatLng(12.9341, 77.6043);
    var mapOptions = {
      zoom: 14,
      center: dharmaram,
      mapTypeControlOptions: { mapTypeIds: [ 'Styled'] },
      mapTypeId: 'Styled'
    };
    var map = new google.maps.Map(document.getElementById("venue-map"), mapOptions);
    map.mapTypes.set('Styled', retroMapType);

    var marker = new google.maps.Marker({
      position: dharmaram,
      map: map,
      title: "Dharmaram College"
    });
    var infowindow = new google.maps.InfoWindow({
      content: '<h3>Dharmaram College</h3><p>Christ University Campus. <a target="_blank" href="http://goo.gl/maps/jYyv">See larger map</a>.</p>'
    });
    google.maps.event.addListener(marker, 'click', function() {
      infowindow.open(map, marker);
    });
    infowindow.open(map, marker);
  },1000);

  
  setTimeout(function kickUtm(){
    if(history.replaceState && location.search.indexOf("utm_") > 0){
      var orig = location.href;
      var fixed = orig.replace(/\?([^#]*)/, function(_, search) {
        search = search.split('&').map(function(v) {
          return !/^utm_/.test(v) && v;
        }).filter(Boolean).join('&');
        return search ? '?' + search : '';
      });
      if ( fixed != orig ) {
        history.replaceState({}, '', fixed);
      }
    }
  },1000);
});