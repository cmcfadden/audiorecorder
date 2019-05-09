(function () {
  // Improve performance by mapping IDs
  var subContentIdToLibraryMap = {};

  /**
   * Look through params to find library name.
   *
   * @private
   * @param {number} id
   * @param {object} params
   */
  function findSubContentLibrary(id, params) {
    for (var prop in params) {
      if (!params.hasOwnProperty(prop)) {
        continue;
      }

      if (prop === 'subContentId' && params[prop] === id) {
        return params.library; // Found it
      }
      else if (typeof params[prop] === 'object') {
        // Look in next level
        var result = findSubContentLibrary(id, params[prop]);
        if (result) {
          return result;
        }
      }
    }
  }

  if (window.H5P) {
    H5P.jQuery(window).on('ready', function () {
      H5P.externalDispatcher.on('xAPI', function (event) {
        try {
          if (!window.parent.ga) {
            return;
          }

          // First we need to find the category.
          var category;

          // Determine content IDs
          var contentId = event.data.statement.object.definition.extensions['http://h5p.org/x-api/h5p-local-content-id'];
          var subContentId = event.data.statement.object.definition.extensions['http://h5p.org/x-api/h5p-subContentId'];

          if (subContentId) {
            if (subContentIdToLibraryMap[subContentId]) {
              // Fetch from cache
              category = subContentIdToLibraryMap[subContentId];
            }
            else {
              // Find
              category = findSubContentLibrary(subContentId, JSON.parse(H5PIntegration.contents['cid-' + contentId].jsonContent));
              if (!category) {
                return; // No need to continue
                // TODO: Remember that it wasnt found?
              }

              // Remember for next time
              subContentIdToLibraryMap[subContentId] = category;
            }
          }
          else {
            // Use main content library
            category = H5PIntegration.contents['cid-' + contentId].library;
          }

          // Strip version number
          category = category.split(' ', 2)[0];

          // Next we need to determine the action.
          var action = event.data.statement.verb.id;
          action = action.substring(action.lastIndexOf('/') + 1);
          action = action.split('-'); // Split words
          for (var i = 0; i < action.length; i++) {
            // Capitalize Each Word
            action[i] = action[i].charAt(0).toUpperCase() + action[i].slice(1);
          }
          action = action.join(' ');

          // Shorthand
          var objectDefinition = event.data.statement.object.definition;

          // Now we need to find an unique label
          var label = objectDefinition.name ? objectDefinition.name['en-US'] : objectDefinition.description['en-US']; // Title
          if (label.length > 384) {
            // Avoid GA's 500 bytes limit
            label = label.substring(0, 384);
          }
          // Add contentID to make it eaiser to find
          label += ' (' + contentId;
          if (subContentId) {
            label += ' ' + subContentId;
          }
          label += ')';

          // Find value
          var value;

          // Use result if possible
          var result = event.data.statement.result;
          if (result) {
            if (result.response) {
              if (isNaN(Number(result.response))) {
                // Use length
                value = result.response.length;
              }
              else {
                value = result.response;
              }
            }
            else if (result.score) {
              // Calculate percentage
              value = result.score.raw / ((result.score.max - result.score.min) / 100);
            }
          }

          // ... or slide number
          if (action === 'Progressed') {
            var progress = event.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point'];
            if (progress) {
              value = progress;
            }
          }

          // Validate number
          value = Number(value);
          if (isNaN(value)) {
            value = undefined;
          }

          window.parent.ga('send', 'event', category, action, label, value);
        }
        catch (err) {
          // No error handling
        }
      });
    });
  }
})();
