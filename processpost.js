const fs = require("fs")
const exec = require("child_process").exec

var postname = process.argv[2]
var year = process.argv[3]

if (!year) {
	year = new Date().getFullYear()
}



console.log("Processing "+postname+".html")

exec('node tiddly2blog_node.js "'+year+'PostsToProcess/'+postname+'.html" > "'+year+'/'+postname+'.html"',function(error,stdout,stderr) {
	if (error) {
		console.error("Error while processing: "+error)
	}

	var yearIndex = genIndex(year)

	//Generate the html for the home page for the year
	for (var i =0; i<yearIndex.length; i++) {
		var post = yearIndex[i]
		var dateWords = post.date.split(" ")
		
		var month = dateWords[1]
		var year = dateWords[2]
		var time = dateWords[4]
		var amPm = (time.substr(-2) == "pm") //false = am, true=pm
		var timeSplit = time.substr(0,time.length-2).split(":")
		var hour = parseInt(timeSplit[0])+12*amPm
		
		var minute = timeSplit[1]
		
		var dayOfMonth = dateWords[0].substr(0,dateWords[0].length-2)
		
		var dateObj = new Date(month+" "+dayOfMonth+", "+year+" "+hour+":"+minute+":00")
		var ms = dateObj.getTime()
		post.timestamp = ms
	}

	yearIndex.sort(function(post1,post2) {
		return post2.timestamp-post1.timestamp
	})
	
	var outHTML = ""
	for (var j = 0; j<yearIndex.length; j++) {
		if (j < yearIndex.length) {
			var post = yearIndex[j]
	
			outHTML += '\n<div class="post-preview">'
			+'\n<a href="'+post.link+'">'
			+'\n<h2 class="post-title">'
			+post.title
			+'</h2>'
			+'\n<h3 class="post-subtitle">'
			+post.subtitle
			+'</h3>'
			+'\n</a>'
			+'\n<p class="post-meta">Posted by <a href="about.html">Kerwizzy</a> on '+post.date+'</p>'
			+'\n</div>'
			+"\n<hr>"
		}
	}
	
	/*
	outHTML += 
		"<ul class='pager'>"
		if (page > 0) {
		outHTML +=
		'<li class="previous">'
		+'<a href="index.html?page='+(page-1)+'">&larr; Newer Posts </a>'
		+'</li>'
		}
		
		if (page < maxPage) {
		outHTML +=
		'<li class="next">'
		+'<a href="index.html?page='+(page+1)+'">Older Posts &rarr;</a>'
		+'</li>'
		}
		outHTML += 
		"</ul>"
	*/
		
	var indexHTML = fs.readFileSync("./"+year+"/index.html","utf-8")
	
	var postListStartString = "<!--@@POSTLISTSTART-->"
	var postListEndString = "<!--@@POSTLISTEND-->"
	
	
	var postListStart = indexHTML.indexOf(postListStartString)+postListStartString.length
	var postListEnd = indexHTML.indexOf(postListEndString)
	
	if (postListStart == -1 || postListEnd == -1) {
		console.error("Could not find template strings to insert post list.")		
	} else {
	
		var beforePostList = indexHTML.substr(0,postListStart)
		var afterPostList = indexHTML.substr(postListEnd)+postListEndString.length
				
		indexHTML = beforePostList+outHTML+afterPostList

		fs.writeFileSync("./"+year+"/index.html",indexHTML)
	}
})

function genIndex(year) {
	var dir = fs.readdirSync("./"+year)
	
	var index = []
	for (var i = 0; i<dir.length; i++) {
		var filename = index[i]
		if (filename.substr(-5) == ".html") {
			var kbData = readKbData("./"+year+"/"+filename)
			index.push("kbData")			
		}
	}
	
	return index
}

function readKbData(filename) {
	var post = fs.readFileSync(filename,{encoding:"utf-8"})

	var kbDataStartString = "<!--KBDATA:"

	var kbDataStart = post.indexOf(kbDataStartString)

	var postAfterDataStart = post.substr(kbDataStart+kbDataStartString.length)
	var kbDataEnd = postAfterDataStart.indexOf("-->")

	var kbDataString = postAfterDataStart.substr(0,kbDataEnd)

	var kbData = JSON.parse(kbDataString)
	return kbData
}
