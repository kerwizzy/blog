/* Copyright 2017 Forrest J. Cavalier III. MIT LICENSE. NO WARRANTY. http://www.mibsoftware.com
       - Badgerfish convention: works for regular XML, with attributes too, but does not allow inlined mixed text/tags e.g.   some <STRONG>loss</STRONG here.

       - Parker Convention: makes attributes inaccessible, removes some tag names.

       - JsonML: became aware of JsonML after doing most of this work.  This re-invents JsonML
	with some variations.  In looking at this work, it appears that improvements can be:
		- close tags are overhead,
		- optional inclusion of whitespace.
		- "<" is overhead.  Tag will always be the first element in an array.
		- {} is fewer characters than null
		- {} tag index can be optional.
		- xml attribute names do not start with space.  This can be used to overload, but
		  it would be better to put {} after the {style}.

In C:
	index
	pointer

The basic problem is that although JSON has one way to accessed named children, XML
has three ways to have children:
	<tag attribute="one way">
		<attribute>second way</attribute> 
		and finally 
		<attribute>third way</attribute>
	</tag>
There are cases when a particular well-formed XML may have no attributes, and
child tags which are all the same, or uniquely named.  The Parker convention works
for these, but is a one way conversion, as some information is lost.

There are cases when a particular well-formed XML may have attributes, and
child tags which have no interspersed text.  The Badgerfish convention works for
these, but is a one way conversion, as some information is lost.

This uses a different convention to transform XML to JSON that preserves attributes
and interspersed text. Unlike the Badgerfish and Parker conventions, this conversion
is not lossy.

XML is mapped a JSON array that has five kinds of array items:
     - a string starting with "<", this is a tag.
     - null, or a collection of attributes
     - an array, which is a XML container
     - a string not starting with "<", which is text.
     - an index to tags, which is always the last element in the array.


So the XML example:
	<tag attribute="one way">
		<child prop="example">second way</child> 
		and finally 
		<child>third way</child>
	</tag>

is mapped to:

[
"	"
,["<tag",{"attribute":"one way"}
  ,"\n		"
  ,["<child",{"prop":"example"}
    ,"second way"
    ,"</child", { tagindex:{}} ]
  ," "
  ,"\n		and finally "
  ,"\n		"
  ,["<child",null
    ,"third way"
    ,"</child", { tagindex:{}} ]
  ,"\n	"
  ,"</tag", { tagindex:{"child":[3,7]}} ]
,"\n"
]

Access by structured tag name uses the collection which is always the last element of the array.
If there can be more than one tag with a given name, the index will be an array.

To find the token index of "<tag", this would be as follows.
      var i = obj[obj.length-1]["tag"];

To access attributes, use the fact attributes always follow a tag.  So if i is
the index to a tag, 
      obj[i+1].attribute
would get the value.

TODO: test that parses full HTML including <!--  -->
TODO: need to change the way tags are indexed to allow future expansion, including
	source location line numbers, functions.
      allow extensibility with use of 'x' prefix tags.
      strong-name prefix tags. 's'
TODO: XML writer.
TODO: parse directly to object?

TODO: Name.
	TSD is table synch data
        SD structured data
	JSD  javascript structured data
	XXO  XML Xform object
        X20
        SXD  structured xform data
        SXO  structured xform object.  Problem: sexo.
        softxo  software xform object.  But not software
        DXO  data transform object
        XTO  xml transform object
        XJO  xml javascript object
	JXC  json xml container
	JSX  json xml container
	X2J
	JCX  Json container for xml

TODO: good API.





*/
/* Design:
    When parse a close tag, need to go backwards to find its start, and then
    "indent" it.
 */

function qname(m)
{
	return "\x22" + m + "\x22";
} /* qname */
function qstring(s)
{

    /* TODO: other escaping */
    s = s.replace(/\r/g,"\\r");
    s = s.replace(/\n/g,"\\n");
    s = s.replace(/\"/g,"\\\"");
	s = s.replace(/\t/g, "\\t")
	return "\x22" + s + "\x22";
} /* qstring */

function xml2json(xml,preservespacecontent)
{

function fixindexes(obj,ibase)
{
var out = "";
for(var m in obj) {
    if (obj.hasOwnProperty(m)) {
//	alert(m + ":" + obj[m]);
	var idx = obj[m];//.replace("undefined,","");
	if (out != "") {
	   out = out + ", ";
	}
	if (idx.indexOf(',') >= 0) {
		var rebase = idx.split(",");
		for(var irebase = 0;irebase < rebase.length;irebase++) {
			rebase[irebase] -= ibase;
		}
		out = out + qname(m) + ":[" + rebase.join(",") + "]";
	} else {
		out = out + qname(m) + ":" + ((parseInt(idx)-ibase) + "");
	}
    }
}
//alert("returning:" + out);
return out;
}
/**************************************************************/


/**************************************************************/
/*DEBUG: not showing tag index on outermost tag, related to DEBUG: what if starts with content? 
If starts with content, then enclose in a null tag.  null,null.
*/
/*[d]not finding some open tags.
/*[d] attribute lists are not proper JSON objects. */
/*[d]DEBUG: self-closing tags are not handled properly. */
/*[d]DEBUG: tags closing with '?' are not handled properly */
/*[d]DEBUG: CDATA and comments, including split lines */
/*[d]DEBUG: attribute names not escaped */
/*[d]DEBUG: commas inside tag indexes */
/*[d]DEBUG: extra \n items getting inserted */
/*[c]DEBUG: string escaping */
function fixattributes()
{
var lines = xml.split("\"");
xml = ""; /* We will rebuild */
var i;
	for (i =0;i < lines.length;i++) {
		if ((i % 2)==0) {
			//Unchanged.
		} else { //Inside doublequotes.
			lines[i] = lines[i].replace('&','&amp;');
			lines[i] = lines[i].replace('<','&lt;');
			lines[i] = lines[i].replace('>','&gt;');
			lines[i] = '"' + lines[i] + '"';
		}
		//	echo lines[I];
		xml = xml + lines[i];
	}
}

function lexsegment(/*string*/xmlsegment)
{
/* As used here, an xmlsegment starts with a tagged element, which may have attributes,
   followed by tagless content.  The segment ends at the next '<'.
 */

    /* 1. Split segment into two parts: XML element, tagless content. */
    var pos = xmlsegment.indexOf('>')
    var attributes = "null"; /* Default.  Note this is "null" not null. */
    var tag;
    var content;
    if (pos >= 0) {
	    tag = xmlsegment.substr(0,pos); 
	    content = xmlsegment.substr(pos+1);

        /* 2. Split first part into tag and attributes. */
        var iposwhite = 0;
        while(iposwhite < tag.length && tag[iposwhite] > ' ' && tag[iposwhite] < '\x7f') {/*DEBUG: unicode? */
	        iposwhite++;
        }
        if (iposwhite >= 0 && iposwhite < tag.length) {
            /* There are attributes */
            if (tag[tag.length-1]=='/') {
                /* Self closing */
	        attributes = tag.substr(iposwhite+1,tag.length-iposwhite-2);
	        if (attributes == "") {
		    attributes = "null";
	        }
                tag = tag.substr(0,iposwhite) + "/"; /* strip */
            } else {
	        attributes = tag.substr(iposwhite+1);
                tag = tag.substr(0,iposwhite); /* strip */
            }
        } else {
	        /* no attributes */
        }
        if (attributes[attributes.length-1]=='?') {
	        attributes = attributes.substr(0,attributes.length-1);
        }
    } else {
	    tag = null;
	    content = xmlsegment;
    }
    /* 3. return the 3 parts */
    return { "tag": tag, "attributes":attributes, "content":content };
} /* lexsegment */

function closeifopen(/*array*/out)
{
    var iopen = out.length;
	var look = out[iopen-1].replace("/","");
    var joined = ""; /* Joined elements */
	var tagcollection = {}; /* Build tag collection */
	/* Find an open which matches.  We are going to replace all
           intervening array elements into one.
         */
    while(iopen > 0) {
	    iopen--;
	    var check = out[iopen];
	    if (check.indexOf("[\"<") == 0 && check[4] != '/') {
			var indextag = check.substr(3,check.indexOf('\"',3)-3);
			if (tagcollection[indextag]) {
				tagcollection[indextag] = iopen + "," + tagcollection[indextag];
			} else {
				tagcollection[indextag] = iopen + "";
			}
        }
        if (check == look) {
			out.splice(iopen+1,out.length-iopen);
			out[iopen] = "[" + check + "," + joined; /* joined starts with attributes. Elide attributes onto same line. */
			out[iopen] += ", { \"tagindex\":{" + fixindexes(tagcollection,iopen) + "}";
			out[iopen] += "}";
			out[iopen] = out[iopen].replace(/\n/g,"\n  ") + " ]"; // Pretty indents
			return; //iopen = -1;
		} else {
			if (joined != "") {
				joined = "\n," + joined;
			}
			joined = check + joined;
        }
	    
    }
	if (iopen == 0) {
	//	out[out.length-1] += "not opened?";
	}
} /* closeifopen */


preservespacecontent = true;
//echo "I-19" . $xml . "\n";
lines = xml.split("<");
var nest = 0;
var indent = "";
var childcount = [];
childcount[0] = 0;
var out = [];
for (i = 0;i < lines.length;i++) {
	if (i == 0 && lines[i]=="" && lines.length > 1) {
		/* Source starts with tag, do not bother emitting an item for empty content. */
		i++;
		bStartTag = true;
	}


	var xmlsegment = lexsegment(lines[i]);
	var tag = xmlsegment.tag;
	var attributes = xmlsegment.attributes;
	var content = xmlsegment.content;
	
	if (false) {
		out.push(i + ":" + line.replace("<","&lt;") + "<BR>");
	} else  {
		if (!tag) {
		} else if ((tag.substr(0,8)=='!doctype') || (tag.substr(0,8) == '![CDATA[')||(tag.substr(0,3) == '!--')) {
			var endseq;
			var collect = "";
			if (tag.substr(0,8) == '![CDATA[') {
				endseq = "]]>";	//CDATA ends with ]]>
			} else if (tag.substr(0,8) == '!doctype') {
				collect = " ";
				endseq = ">";
			} else {
				endseq = "-->";
			}
			/* The split at start element '<' did not take into account the
		end sequence.  So we walk forward to find it.
		*/
			while(i < lines.length) {
				var posendcdata = lines[i].indexOf(endseq); 
				if (posendcdata >= 0) {
					/* End is here */
					collect = collect + "<" + lines[i].substr(0,posendcdata+endseq.length);
					/* Reparse the rest of line */
					lines[i] = lines[i].substr(posendcdata+endseq.length);
					//		out.push("/*303 " + lines[i] + "*/");
					i--; 
					content = null;
					break;
				} else {
					collect = collect + "<" + lines[i];
				}
				i++;
			}
			out.push(qstring(collect.substr(1)));
			//	out.push("/*313*/");
		} else if (tag[0] == '/') {
			/* In well-formed XML, close tags have no attributes, so code here does not handle. */
			out.push("\"<" + tag + "\"");
			closeifopen(out);
		} else {
			out.push("\"<" + tag + "\"");
			if (attributes == "null") {
				out.push(attributes);
			} else {
				/* Transform the attributes to JSON, including string escapes. */
				var attribs = attributes.split('\x22');
				var iAttrib = 0;
				while(iAttrib < attribs.length) {
					var att = attribs[iAttrib];
					if (att[att.length-1]=='=') { /* Should always be true!, but we check anyway. */
						att = att.trim();
						att = qname(att.substr(0,att.length-1)) + ':';
						if (iAttrib > 0) {
							att = "," + att;
						}
					} /* else: no error. */
					attribs[iAttrib] = att;
					if (iAttrib +1 < attribs.length) {
						attribs[iAttrib+1] = qstring(attribs[iAttrib+1]);
					}
					iAttrib += 2;
				}
				out.push("{" + attribs.join("") + "}"); /* attributes */
			}
			if (tag[tag.length-1] == '/') { /* Not a container.  Elide attributes now. */
				out[out.length-2] = out[out.length-2] +"," + out[out.length-1];
				out.splice(out.length-1,1);
			}
		}

		/*** Handle content ***/
		if (!content) {
		} else if (!preservespacecontent && content.replace(/[ \t\n]/g,'')=='') {

		} else if (content.indexOf("\n") >= 0) {
			var sep = content.split("\n");
			if (sep[0] != "") {
				out.push(qstring(sep[0]));
			}
			var isep = 1;
			while(isep < sep.length) {
				out.push(qstring("\n" + sep[isep]));
				isep++;
			}
			
		} else {
			out.push(qstring(content));
		}
	}
}
if (out[0].substr(0,1)!="[") {
	return "[\nnull,null," + out.join("\n,") + ",null,null\n]";
} else {
	return out.join("\n,");
}
} /* xml2json */

var body = "";
var bInBody = false;
var collected = ["","",""];
var iCollecting = -1;
var allOut = [];

if (typeof window == "object") {
} else if (typeof process == "object") {
	//http://stackoverflow.com/questions/20086849/how-to-read-from-stdin-line-by-line-in-node
	const fs = require('fs');
	
	var lingeringLine = "";
    var allLines= [];
	function processLine(s)
	{
		allLines.push(s.replace("\r",""));
//		process.stdout.write(s.charCodeAt(0).toString() + "\n");
	}
	function processAllLines()
	{
		var parsed = xml2json(allLines.join("\n"),1);
//		console.log(parsed);
		var xmlInJson = JSON.parse(parsed);
		showxml(xmlInJson);

		var i = 0;
		while(i < collected.length) {
			while (collected[i] && " \n\t".indexOf(collected[i].substr(0,1)) >= 0) {
				collected[i] = collected[i].substr(1);
			}
			while (collected[i] && " \n\t".indexOf(collected[i].substr(collected[i].length-1)) >= 0) {
				collected[i] = collected[i].substr(0,collected[i].length-1);
			}
			i++;
		}
		var kbdata = {};
		kbdata.title = collected[0].replace(/\n/g," ");
		kbdata.date = collected[1].replace(/\n/g," ");
		kbdata.subtitle = collected[2] ? collected[2].replace(/\n/g," ") : "";
		kbdata['link'] = process.argv[2].replace("PostsToProcess/","");
		console.log("<!--KBDATA:" + JSON.stringify(kbdata)+"-->");
		var template = fs.readFileSync(process.argv[3],"utf-8").split("\n") //htmlTemplate.toString().split("\n");
		template.pop();
		template.shift();
		
		var body = allOut.join("")
		
		var lastDiv = body.lastIndexOf("</div>") //For some reason there are too many </div>'s. This removes the last one.
		body = body.substr(0,lastDiv)+body.substr(lastDiv+6)
		
		var out = template.join("\n")
			.replace(/&lt;!--KB:TITLE--&gt;/g,collected[0])
			.replace("&lt;!--KB:SUBTITLE--&gt;",collected[2] ?collected[2] : "" )
			.replace("&lt;!--KB:DATE--&gt;",collected[1])
			.replace("&lt;!--KB:BODY--&gt;",body);
		//		console.log(allOut.join("").replace('0="\n"',""));
				console.log(out);
		
	}
	if (process.argv[2] == '-') {
		process.stdin.resume();
		process.stdin.setEncoding('utf8');

		process.stdin.on('data', function(chunk) {
			lines = chunk.split("\n");

			lines[0] = lingeringLine + lines[0];
			lingeringLine = lines.pop();

			lines.forEach(processLine);
		});
	

		process.stdin.on('end', function() {
			
			processLine(lingeringLine);
			/*
			process.stdout.write("var xmlInJson = \n");
			process.stdout.write(xml2json(allLines.join("\n"),1));
			process.stdout.write("\n;\n");
			*/
			processAllLines();

		});
	} else {
		var data = fs.readFileSync(process.argv[2]);
		allLines = data.toString().split("\n");
		processAllLines();
	}
} else {
    var line;
    var txt = "";
    while((line=librock_v8_stdio)) {
		txt = txt + line;
    }
    librock_v8_stdio = xml2json(txt,1);
}


function emit(s) {
	//WScript.stdout.Write(s);
	if (bInBody && iCollecting != 2) {
		allOut.push(s)
	}
}
function fixHref(elProps) {
	delete elProps['rel'];
	delete elProps['target'];
	if (elProps['href'] && elProps['href'].substr(0,1)=="#" && elProps['href']!="#") {
		// [APC Desired Edit] if href begins with hashtag, reformat.
		elProps['href'] = elProps['href'].substr(1) + ".html";
	}
}
function fixClass(elProps) {
	// [APC Desired Edit] strip class properties.
	if (elProps['class'] && elProps['class'] != 'kb-caption') {
		delete elProps['class'];
	}
}
function fixImgSrc(elProps) {
	// [APC Desired Edit] make img src shorter. Delete prefix "file:///C:/ambrose/TiddlyWiki/"
	elProps.src = elProps.src.replace('file:///C:/ambrose/TiddlyWiki/','');
}


function showxml(el) {
	var k;
	var i;
//	emit("I-1903 " + typeof(el) + typeof(el.length) + el.length);
	if (typeof(el) == "object" && typeof(el.length)== "number" && el[0]=='<style') {
	/* [APC Desired Edit] delete all <style */
	} else if (typeof(el) == "object" && typeof(el.length)== "number" && el[0]=='<button' && el[1]['class']=="tc-btn-invisible") {
	/* [APC Desired Edit] delete all <tiddly buttons */
	} else if (typeof(el) == "object" && typeof(el.length)== "number") {
		var istart = 2;
		var suppress = false;
		var cStopCollection = false;
		var bStopBody = false;
		
		if (el[0]) {
			if (el[0] == "<a") {
				if (el[1].name) {
					suppress = true;
				}
				fixHref(el[1]);
			}
			if (el[1] && el[1]['class']) {
				if (el[1]['class'].indexOf('tc-title')>= 0) {
					iCollecting = 0;
					cStopCollection = true;
				} else if (el[1]['class'].indexOf('tc-subtitle')>= 0) {
					iCollecting = 1;
					cStopCollection = true;
				} else if (el[1]['class'].indexOf('tc-tiddler-body')>= 0) {
					bInBody = true;
					bStopBody = true;
					if (el[2] && el[2][0] == '<p') {
						if (el[2][2] && el[2][2][0] == '<em') {
							iCollecting = 2;
						}
					}
				}
					
			} else {
//unchanged
			}
			if (iCollecting == 2 && el[0] == "<em") {
				cStopCollection = true;
			}
			if (!suppress) {
				emit(el[0]);
				if (el[1]) {
					fixClass(el[1]);
					for(k in el[1]) {
		//				emit("(I-1908" + i + ")");
						emit(" " + k + "=\x22");
		//				emit("I-1910" + i + ")");
						emit(el[1][k] + "\x22");
					}
				}
				emit(">");
			}
		}
		for(i = istart; i < el.length-2;i++) {

			if (el[i].substr && el[i].substr(0,1) == '<') { /* Self-closing tag */
//				emit("(I-1916 " + i + ")");
				if (el[i] == "<img") {
					fixImgSrc(el[i+1]);
				}
				emit(el[i].replace("/",""));
				i++;
				for(k in el[i]) {
//					emit("(I-1920" + i + ")");
					emit(" " + k + "=\x22");
					emit(el[i][k] + "\x22");
				}
				if (el[i-1].substr(0,2)=="<!") {
					
				} else if (el[i-1].substr(el[i-1].length-1)=="/") {
					emit(" />");
				} else {
					emit(">");
				}
			} else {
/*
              ,["<p",null
                ,"<img"
                ,{"src":"file:///C:/ambrose/TiddlyWiki/KerwizzyBlogData/KerslowlyRay_SineWave.png"}
                ,"</p", { tagindex:{}} ]
              ,["<p",null
                ,["<em",null
*/
				if (el[i][0] && el[i][0] == "<p" && el[i][2] && el[i][2] == '<img') {
					/* We are at an image. */
					
					/* The element after this is a <p and <em, then count it as a caption, and mark it. */
					if (el[i+1][0] && el[i+1][0] == "<p" && el[i+1][2][0] && el[i+1][2][0]=="<em") {
						if (!el[i+1][1]) {
							el[i+1][1] = {};
						}
						if (!el[i+1][1]['class']) {
							el[i+1][1]['class'] = "kb-caption";
						} else {
							el[i+1][1]['class'] += " kb-caption";
						}
						
					}
				}
//				emit("I-1924{" + i + "}:");
				showxml(el[i]);
			}
		}
		if (!suppress) {
			if (el[el.length-2]){
				emit(el[el.length-2] + ">");
			}
		}
		if (bStopBody) {
			bInBody = false;
		}
		if (cStopCollection) {
			iCollecting = -1;
		}
	} else {
		if (iCollecting >= 0) {
//			console.log("I-647 " + iCollecting + typeof(collected));
			collected[iCollecting] += el;
		}
		emit(el);
	}
}
function htmlTemplate(){/*
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="">
    <meta name="author" content="">

    <title>&lt;!--KB:TITLE--&gt; | Kerwizzy's Blog</title>

    <!-- Bootstrap Core CSS -->
    <link href="vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet">

    <!-- Theme CSS -->
    <link href="css/clean-blog.css" rel="stylesheet">

    <!-- Custom Fonts -->
    <link href="vendor/font-awesome/css/font-awesome.min.css" rel="stylesheet" type="text/css">
    <!-- <link href='https://fonts.googleapis.com/css?family=Lora:400,700,400italic,700italic' rel='stylesheet' type='text/css'> -->
    <link href='https://fonts.googleapis.com/css?family=Open+Sans:300italic,400italic,600italic,700italic,800italic,400,300,600,700,800' rel='stylesheet' type='text/css'>

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
        <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
        <script src="https://oss.maxcdn.com/libs/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->
	

</head>

<body>

    <!-- Navigation -->
    <nav class="navbar navbar-default navbar-custom navbar-fixed-top">
        <div class="container-fluid">
            <!-- Brand and toggle get grouped for better mobile display -->
            <div class="navbar-header page-scroll">
                <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
                    <span class="sr-only">Toggle navigation</span>
                    Menu <i class="fa fa-bars"></i>
                </button>
                <a class="navbar-brand" href="index.html">Kerwizzy's Blog</a>
            </div>

            <!-- Collect the nav links, forms, and other content for toggling -->
            <div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
                <ul class="nav navbar-nav navbar-right">
                    <li>
                        <a href="index.html">Home</a>
                    </li>
                    <li>
                        <a href="about.html">About</a>
                    </li>
					<li>
                        <a href="http://kerwizzy.github.io">Kerwizzy's Programming Lab</a>
                    </li>
                </ul>
            </div>
            <!-- /.navbar-collapse -->
        </div>
        <!-- /.container -->
    </nav>

    <!-- Page Header -->
    <!-- Set your background image for this header on the line below. -->
    <header class="intro-header" style="background-image: url('PostHeaderImage_v2_scaled.jpg')">
        <div class="container">
            <div class="row">
                <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
                    <div class="post-heading">
                        <h1>&lt;!--KB:TITLE--&gt;</h1>
                        <h2 class="subheading">&lt;!--KB:SUBTITLE--&gt;</h2>
                        <span class="meta">Posted by <a href="about.html">Kerwizzy</a> on &lt;!--KB:DATE--&gt;</span>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Post Content -->
    <article>
        <div class="container">
            <div class="row">
                <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
				
				&lt;!--KB:BODY--&gt;
				
				<BR>
				<hr>
				Comment on <a href='https://twitter.com/kerwizzy'>Twitter</a>
                </div>
            </div>
        </div>
    </article>

    <hr>

    <!-- Footer -->
    <footer>
        <div class="container">
            <div class="row">
                <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
                    <ul class="list-inline text-center">
                        <li>
                            <a href="https://twitter.com/kerwizzy">
                                <span class="fa-stack fa-lg">
                                    <i class="fa fa-circle fa-stack-2x"></i>
                                    <i class="fa fa-twitter fa-stack-1x fa-inverse"></i>
                                </span>
                            </a>
                        </li>
                        <li>
                            <a href="https://github.com/kerwizzy">
                                <span class="fa-stack fa-lg">
                                    <i class="fa fa-circle fa-stack-2x"></i>
                                    <i class="fa fa-github fa-stack-1x fa-inverse"></i>
                                </span>
                            </a>
                        </li>
                    </ul>
                    <p class="copyright text-muted">Copyright &copy; Kerwizzy 2017</p>
                </div>
            </div>
        </div>
    </footer>

    <!-- jQuery -->
    <script src="vendor/jquery/jquery.min.js"></script>

    <!-- Bootstrap Core JavaScript -->
    <script src="vendor/bootstrap/js/bootstrap.min.js"></script>

    <!-- Contact Form JavaScript -->
    <script src="js/jqBootstrapValidation.js"></script>
    <script src="js/contact_me.js"></script>

    <!-- Theme JavaScript -->
    <script src="js/clean-blog.min.js"></script>

</body>

</html>

*/}
