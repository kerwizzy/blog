/*
HOW TO USE

This program helps to take blog posts from tiddlywiki and convert them to the blog format.

This is the basic process for doing this:

1. Export the post from tiddlywiki as an HTML file and and stick it in the "PostsToProcess" directory

2. Run "node processpost.js -p <title post>.html"

3. This will generate an html file in the /<year> directory, as well as updating the index.

After doing this, just commit and push!






*/




const fs = require("fs")
const exec = require("child_process").exec

var mode = process.argv[2]

if (mode == "-i" || mode == "--index") {
	var currentDir = fs.readdirSync("./")
		
	var years = []
	for (var i = 0; i<currentDir.length; i++) {
		if (!isNaN(parseInt(currentDir[i]))) {
			years.push(currentDir[i])
		}		
	}
	
	for (var j = 0; j<years.length; j++) {
		var year = years[j]
		updateYearIndex(year)
	}
	
	updateMasterIndex()
} else if (mode == "-h" || mode == "--help") {
	console.log("Usage: node processpost.js <flag> [<title>]")
	console.log("Flags:")
	console.log("-p --process: process blog post with title <title>")
	console.log("-i --index: update the index")
	console.log("-h --help: show the help")
	console.log("Read the header in processpost.js for detailed help.")
} else if (mode == "-p" || mode == "--process") {
	
	var postname = process.argv[3]
	var postyear = process.argv[4]

	if (!postyear) {
		var tempDate = new Date()
		console.log("Year undefined. Setting year to "+tempDate.getFullYear())
		postyear = tempDate.getFullYear()
	}



	console.log("Processing "+postname+".html")

	exec('node tiddly2blog_node.js "'+postyear+'/PostsToProcess/'+postname+'.html" post_template.html > "'+postyear+'/'+postname+'.html"',function(error,stdout,stderr) {
		if (error) {
			console.error("Error while processing: "+error)
		}
		
		
		updateYearIndex(postyear)//Regenerate the index for just the post year
		updateMasterIndex() //Regenerate the master index
	})

} else {
	console.log("Unrecognized flag. Use -h to display help.")
}

function updateYearIndex(year) {
	console.log("Generating index for "+year)
	genIndex(year)

	var yearIndex = genIndex(year)
	
	for (var k =0; k<yearIndex.length; k++) {
			var post = yearIndex[k]
			
			post.link = post.link.substr(5) //remove the YYYY/ that gets inserted	
	}
	
	var yearIndexHTML = genIndexHTML(yearIndex,"./"+year+"/index.html")		
	fs.writeFileSync("./"+year+"/index.html",yearIndexHTML)	
}

function updateMasterIndex() {
	console.log("Generating master index")
	
	var currentDir = fs.readdirSync("./")
		
	var years = []
	for (var i = 0; i<currentDir.length; i++) {
		if (!isNaN(parseInt(currentDir[i]))) {
			years.push(currentDir[i])
		}		
	}
	
	var masterIndex = []
	for (var j =0; j<years.length; j++) {
		var year = years[j]
		
		var indexForThisYear = genIndex(year)
		
		
		
		masterIndex = masterIndex.concat(indexForThisYear)		
	}
	
	var masterIndexHTML = genIndexHTML(masterIndex,"index.html")
	fs.writeFileSync("index.html",masterIndexHTML)
}

function genIndexHTML(index,template) {
	//Generate the html for the home page for the year
	for (var i =0; i<index.length; i++) {
		var post = index[i]
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

	index.sort(function(post1,post2) {
		return post2.timestamp-post1.timestamp
	})
	
	var outHTML = ""
	for (var j = 0; j<index.length; j++) {
		if (j < index.length) {
			var post = index[j]
	
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
		
	var indexHTML = fs.readFileSync(template,"utf-8")
	
	var postListStartString = "<!--@@POSTLISTSTART-->"
	var postListEndString = "<!--@@POSTLISTEND-->"
	
	
	var postListStart = indexHTML.indexOf(postListStartString)+postListStartString.length
	var postListEnd = indexHTML.indexOf(postListEndString)
	
	if (postListStart == -1 || postListEnd == -1) {
		console.error("Could not find template strings to insert post list in "+template)		
	} else {
	
		var beforePostList = indexHTML.substr(0,postListStart)
		var afterPostList = indexHTML.substr(postListEnd)
				
		indexHTML = beforePostList+outHTML+afterPostList

		return indexHTML
	}	
}


function genIndex(year) {
	//console.log("Generating index for "+year)
	
	var dir = fs.readdirSync("./"+year)
	
	var index = []
	for (var i = 0; i<dir.length; i++) {
		var filename = dir[i]
		if (filename.substr(-5) == ".html" && filename.substr(-7,2) != "NP" && filename != "index.html") { //NP means "Not Post"
			var kbData = readKbData("./"+year+"/"+filename)
			index.push(kbData)			
		}
	}
	
	return index
}

function readKbData(filename) {
	var post = fs.readFileSync(filename,{encoding:"utf-8"})
	console.log("Reading kbData from "+filename)
	var kbDataStartString = "<!--KBDATA:"

	var kbDataStart = post.indexOf(kbDataStartString)

	var postAfterDataStart = post.substr(kbDataStart+kbDataStartString.length)
	var kbDataEnd = postAfterDataStart.indexOf("-->")

	var kbDataString = postAfterDataStart.substr(0,kbDataEnd)

	var kbData = JSON.parse(kbDataString)
	return kbData
}
