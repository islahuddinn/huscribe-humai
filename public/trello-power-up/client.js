/* global TrelloPowerUp */

// Initialize Power-Up
window.TrelloPowerUp.initialize({
  // Card buttons
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://cdn.glitch.com/1b42d7fe-bda8-4af8-a6c8-eff0cea9e08a%2Frocket-ship.png?1494946700421',
      text: 'My Backend Integration',
      callback: function(t) {
        return t.popup({
          title: 'Connect with Backend',
          url: './card-popup.html',
          height: 300
        });
      }
    }];
  },
  
  // Authorization capability
  'authorization-status': function(t, options) {
    return t.get('member', 'private', 'token')
      .then(function(token) {
        return { authorized: token != null };
      });
  },
  
  'show-authorization': function(t, options) {
    return t.popup({
      title: 'Authorize with Trello',
      url: './authorize.html',
      height: 140
    });
  }
}); 