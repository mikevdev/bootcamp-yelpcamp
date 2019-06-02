require("dotenv").config();

var express = require("express"),
	bodyParser = require("body-parser"),
	Campground = require("./models/campground"),
	mongoose = require("mongoose"),
	flash = require("connect-flash"),
	passport = require("passport"),
	LocalStrategy = require("passport-local"),
	methodOverride = require("method-override"),
	Comment = require("./models/comment"),
	seedDB = require("./seeds"),
	User = require("./models/user"),
	app = express();

//requiring routes
var commentRoutes = require("./routes/comments"),
	campgroundRoutes = require("./routes/campground"),
	indexRoutes = require("./routes/index"),
	reviewRoutes = require("./routes/reviews");

//seedDB();

var url = process.env.DATABASEURL || process.env.LOCALDATABASEURL;

mongoose.connect(url, { useNewUrlParser: true });

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(methodOverride("_method"));
app.use(flash());
app.locals.moment = require("moment");

app.use(
	require("express-session")({
		secret: process.env.COOKIESECRET,
		resave: false,
		saveUninitialized: false
	})
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);

var port = process.env.PORT || 3000;
app.listen(port, process.env.IP, function() {
	console.log("The YelpCamp Server Has Started");
});
