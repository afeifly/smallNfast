<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE helpset PUBLIC "-//Sun Microsystems Inc.//DTD JavaHelp HelpSet Version 2.0//EN"
                         "http://java.sun.com/products/javahelp/helpset_2_0.dtd">

<helpset version="2.0" xml:lang="zh">
	<title>压缩空气分析软件（CAA）帮助</title>
	<maps>
		<homeID>caa</homeID>
		<mapref location="map.jhm"/>
	</maps>
	<view mergetype="javax.help.UniteAppendMerge">
		<name>TOC</name>
		<label>helpset.toc.title</label>
		<type>javax.help.TOCView</type>
		<data>toc.xml</data>
	</view>
	<view mergetype="javax.help.NoMerge">
		<name>Favorites</name>
		<label>Favorites</label>
		<type>javax.help.FavoritesView</type>
		<image>favoritesIcon-s</image>
	</view>
	<view>
		<name>Search</name>
		<label>Search</label>
		<type>javax.help.SearchView</type>
		<data engine="com.sun.java.help.search.DefaultSearchEngine">JavaHelpSearch</data>
		<image>searchIcon</image>
	</view>
	<presentation default="true">
		<name>main window</name>
		<size width="800" height="600" />
		<location x="200" y="200" />
		<image>window_icon</image>
		<toolbar>
			<helpaction image="backIcon">javax.help.BackAction</helpaction>
			<helpaction image="forwardIcon">javax.help.ForwardAction</helpaction>
			<helpaction image="homeIcon">javax.help.HomeAction</helpaction>
			<helpaction image="favoritesIcon">javax.help.FavoritesAction</helpaction>
			<helpaction>javax.help.SeparatorAction</helpaction>
			<helpaction image="printIcon">javax.help.PrintAction</helpaction>
			<helpaction image="pageSetupIcon">javax.help.PrintSetupAction</helpaction>
		</toolbar>
	</presentation>
</helpset>
