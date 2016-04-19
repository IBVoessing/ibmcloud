var dom = dojo.require('dojo/dom');
var domConstruct = dojo.require('dojo/dom-construct');
var request = dojo.require('dojo/request');
var base64 = dojo.require('dojox/encoding/base64');
var JSON = dojo.require('dojo/json');
var Standby = dojo.require('dojox/widget/Standby');
var when = dojo.require('dojo/when');
var all = dojo.require('dojo/promise/all');

var eFrontAPIKey;
var eFrontBaseURL;
var toByteArray = function(str) { /* Helper function for the authentication against eFront */
    var bytes = [];
    for (var i = 0; i < str.length; ++i) {
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
};

dojo.provide('com.ibm.efront');
dojo.declare('com.ibm.efront', null, {

    onView:function() {
        var rootElement = this.iContext.getRootElement(); /* This is the root element our widget will be rendered in */

        /* This is the generic error handling function */
        function errorHandler(errorMsg, spinnerStop){
            if (spinnerStop) standby.hide();
            var errorHTML = "<div class='errorNodes'><ul><li><span style='color: red;'><strong>" + errorMsg + "</strong></span></li></ul></div>";
            domConstruct.empty(rootElement.id);
            domConstruct.place(errorHTML, rootElement.id);
            throw new Error(errorMsg);
        }

        /* Retrieve the declared api key from the configuration file */
        if ('api_key' in window.efrontConf && typeof window.efrontConf.api_key !== 'undefined') {
            eFrontAPIKey = window.efrontConf.api_key;
        }
        else{
            errorHandler('ERROR! No API Key was specified. Please define one in \'config.js\'.', false);
        }

        /* Retrieve the declared eFront host from the configuration file */
        if ('host' in window.efrontConf && typeof window.efrontConf.host !== 'undefined') {
            eFrontBaseURL = window.efrontConf.host;
            /* Build the API Base Path */
            var eFrontAPI = eFrontBaseURL + '/API/v1.0';
        }
        else{
            errorHandler('ERROR! No Host was specified. Please define one in \'config.js\'.', false);
        }

        /* Align the loading spinner to the root element */
        var standby = new Standby({target: rootElement.id, color:'none'});
        document.body.appendChild(standby.domNode);
        standby.startup();
        standby.show();

        /* Get the IBM connections user profile. If the email matches anyone against the eFront database, then that
         * user is used. Otherwise a new user is created using the IBM connections userid as the username. */
        try {
            var ibmUserProfile = this.iContext.getUserProfile();
            var ibmUID = ibmUserProfile.getItemValue('userid');
            var ibmUserEmail = ibmUserProfile.getItemValue('email');
            var ibmDisplayName = ibmUserProfile.getItemValue('displayName');
        }
        catch (e){ /* If we can't retrieve that, something is really wrong and the plugin should abort immediatelly */
            errorHandler('A critical error occured while retrieving the system user: ' + e, true);
        }

        if (!ibmUID || !ibmUserEmail || !ibmDisplayName){
            errorHandler('A critical error occured while retrieving the user profile: Insufficient data.', true);
        }

        var userID = request(eFrontAPI + '/Users',{ /* Get the list of available users from eFront */
            headers: {
                "Authorization": "Basic " + base64.encode(toByteArray(eFrontAPIKey + ":"))
            }
        }).then(
            function(text){ /* If any of their emails matches against the current user's email then return the user */
                try {
                    var userListObject = JSON.parse(text);
                }
                catch (e) {
                    errorHandler('An error occured while parsing the list of eFront users: ' + e, true);
                }
                for (var i=0; i<userListObject.data.length; i++) { /* Check current user's email against eFront users' one  */
                    if (ibmUserEmail == userListObject.data[i].email){
                        /* Return the match */
                        return userListObject.data[i].id;
                    }
                }
                return request.post(eFrontAPI + '/User', { /* Otherwise create a new user */
                    headers: {
                        "Authorization": "Basic " + base64.encode(toByteArray(eFrontAPIKey + ":"))
                    },
                    data: {
                        "login": ibmUID,
                        "name": ibmDisplayName,
                        "surname": ibmDisplayName,
                        "email": ibmUserEmail,
                        "password": ibmUserEmail
                    }
                }).then(function (rawUserCreationResponse) {
                    var newUser = JSON.parse(rawUserCreationResponse);
                    /*console.log('here is the new user');
                    console.log(newUser);*/
                    return newUser.data.id;
                }, function(err){
                    errorHandler('ERROR! Unable to create new user account. Please check your network and/or contact your system admin. ' + err, true);
                })
            }, function(err){
                errorHandler('ERROR! Unable to determine current user. Please check your network and/or contact your system admin. ' + err, true);
        });

        function getLoginURL(userID){ /* Once we've got the user id, get the autologin url */
            return when(
                userID,
                function() {
                    return request(eFrontAPI + '/Autologin/' + ibmUID, {
                        headers: {
                            "Authorization": "Basic " + base64.encode(toByteArray(eFrontAPIKey + ":"))
                        }
                    }).then(function (rawUserToken) {
                        try {
                            var userProfile = JSON.parse(rawUserToken);
                        } catch (e) {
                            var errorMsg = 'An error occured while retrieving the login url: ' + e;
                            console.log(errorMsg);
                            throw new Error(errorMsg);
                        }
                        /*console.log(userProfile.data);*/
                        return userProfile.data;
                    }, function (err) {
                        errorHandler('ERROR! Unable to fetch the autologin token. Please check your network and/or contact your system admin. ' + err, true);
                    });
                });
        }

        function getCourseList(userID){ /* Using the UID, Get the user's courses */
            return when(
                userID,
                function(userID) {
                    return request(eFrontAPI + '/User/' + userID, {
                        headers: {
                            "Authorization": "Basic " + base64.encode(toByteArray(eFrontAPIKey + ":"))
                        }
                    }).then(function (rawUserProfile) {
                        var userProfile = JSON.parse(rawUserProfile);
                        /*console.log(userProfile);*/
                        return userProfile.data.courses.list;
                    }, function(err){
                        errorHandler('ERROR! Unable to properly fetch the user\'s courses. Please check your network and/or contact your system admin. ' + err, true);
                    }).then(function(courseList) { /* Enrich courses with progress data */
                        /*console.log(courseList);*/
                        for (var i = 0; i < courseList.length; i++) {
                            courseList[i].lessonList = request(eFrontAPI + '/Course/' + courseList[i].id + '/UserProgress/' + userID, {
                                headers: {
                                    "Authorization": "Basic " + base64.encode(toByteArray(eFrontAPIKey + ":"))
                                }
                            }).then(function (rawCourseData) {
                                var courseData = JSON.parse(rawCourseData);
                                /*console.log(courseData.data);*/
                                return courseData.data;
                            }, function(err){
                                errorHandler('ERROR! Unable to retrieve course progress. Please check your network and/or contact your system admin. ' + err, true);
                            })
                        }
                        return courseList;
                    });
                })
        }

        /* These two function both require the userID but once we secure it they can execute asynchronously. */
        var courseList = getCourseList(userID);
        var autoLoginURL = getLoginURL(userID);

        all({autoLoginURL: autoLoginURL,
            courseList: courseList
        }).then(function(data){ /* Once all pieces have fallen into place, construct the course table */
            /*console.log(data.autoLoginURL);*/
            var eFrontFullURL = eFrontBaseURL + data.autoLoginURL;
            var courseURL = eFrontFullURL + '/go/cstart/course/';
            standby.hide();
            var homebutton = domConstruct.toDom("<a id='gohome' target='_blank' title='eFront Dashboard' href='" + eFrontFullURL + "'><i class='fa fa-home fa-2x'></i></a>");
            domConstruct.place(homebutton, "homebutton");
            if (data.courseList.length) {
                var table = domConstruct.toDom("<div id='table-wrapper'><div id='table-scroll'><table cellspacing='0' class='course_style'><tbody id='efront_rows' class='course_style'></tbody></table></div></div>");
                domConstruct.place(table, "efront_data");
                data.courseList.forEach(function (course) {
                    var courseFullURL = courseURL + course.id;
                    var columnA = "<tr><td><div id='eFrontColumn'><a title='Open course \"" + course.formatted_name + "\"' target='_blank' href=" + courseFullURL + ">" + "<img src='/widgets/eFront/assets/img/book.svg' width='32' height='32' alt='[eFront Course]' class='FloatLeft'/>&nbsp;<strong>" + course.formatted_name + "</strong></a></td></div>";
                    var columnB = "<td style='text-align: center;'><div class='progressBars' id='" + course.id + "'><!--<span class='progress_percentage' style='width: 100%; text-align:center;'>N/A YET</span>--></div></td>";
                    var columnC = "<td class='link' align='center'><a title='Open course \"" + course.formatted_name + "\"' target='_blank' href='" + courseFullURL + "' class='gotocourse'><i class='fa fa-arrow-right fa-2x gotocourseicon'></i></a></td></tr>";
                    var columns = columnA + columnB + columnC;
                    var row = domConstruct.toDom(columns);
                    domConstruct.place(row, "efront_rows");
                    /* This is the final step that needs to calculate
                     the progress once it's properly fetched from the API */
                    when(course.lessonList, function (lessonList) {
                        var lessonsComplete = 0;
                        var courseProgress = 0;
                        lessonList.forEach(function (lesson) {
                            if (lesson.Status == 'passed') {
                                lessonsComplete++;
                            }
                        });
                        if (lessonsComplete) {
                            courseProgress = (lessonsComplete / lessonList.length).toFixed(2);
                            /*console.log('Lesson Complete: Progress is: ' + courseProgress);*/
                        }
                        /* Calculate progress based on how may course lessons are complete */
                        createProgressGraph(course.id, courseProgress);
                    });
                });
            }
            else{ /* In case a user has no courses */
                var nocoursemsg = domConstruct.toDom("<div class='nocourses' style='display: inline-flex;'><img src='/widgets/eFront/assets/img/noCourses.svg' width='64' height='64' alt='[eFront No Course]' class='FloatLeft' style='margin: auto;'/>&nbsp;<h1 style='text-align: center;color: #454545;'>You don't have any courses yet.</h1></div><div id='fetch' style='text-align: center;'>Go to <a target='_blank' href='" + eFrontFullURL + "/go/catalog/'>eFront</a> and get some now!</div>");
                domConstruct.place(nocoursemsg, "efront_data");
                /*console.log('User has no courses');*/
            }

        }, function(err){
            errorHandler('ERROR! Exception occured. Please contact your system admin. ' + err, true);
        });

        function createProgressGraph(domCourseIDTag, percentage){
            var startColor = '#FC5B3F';
            var endColor = '#6FD57F';
            var element = document.getElementById(domCourseIDTag);
            var circle = new ProgressBar.Circle(element, {
                color: startColor,
                trailColor: '#999',
                trailWidth: 1,
                duration: 800,
                easing: 'easeInOut',
                strokeWidth: 5,
                step: function(state, circle) {
                    circle.path.setAttribute('stroke', state.color);
                }
            });
            circle.animate(percentage, {
                from: {color: startColor},
                to: {color: endColor}
            }, function() {
                var truePercentage = percentage * 100;
                if (truePercentage == 100) {
                    circle.setText('✔');
                }
                else{
                    circle.setText(truePercentage + ' %');
                }
            });
        }
        /*console.log('eFront executed successfully!');*/
    }});
