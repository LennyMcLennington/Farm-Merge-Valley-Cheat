# SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
# SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
# SPDX-License-Identifier: AGPL-3.0-only

mkdir -p cache/

curl -s 'https://1187013846746005515.discordsays.com' --output cache/index.html

set js_files (cat cache/index.html | grep -Po '(?<=src=")[^"]+' | grep -v 'https' | sort)

set module_ids (for file_name in $js_files
	curl -s "https://1187013846746005515.discordsays.com/$file_name" --output "cache/$file_name"
	cat "cache/$file_name" | grep -Po '(?<=_0x[A-Za-z0-9]{6}\[\'[^\']{1,10}\'\]\(_0x[A-Za-z0-9]{6},)0x[A-Za-z0-9]{2,6}(?=\))'
end | sort | uniq)

set module_map '{}'
for module_id in $module_ids
	for file_name in $js_files
		set dec (printf '%d' "$module_id")
		set pattern "(?<=(?:$module_id|$dec):)\([A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*\)=>(\{(?:[^{}]|(?1))*\})"
		if test "$module_id" = "0x130f5"
			echo $pattern
		end
		grep -m1 -Po "$pattern" "cache/$file_name" > tmp_grep_output.txt
		set grep_status $status

		if test $grep_status -eq 0
			set module_map (echo $module_map | jq --rawfile v tmp_grep_output.txt -c --arg k "$module_id" '. + {($k): $v}' | string collect)
			rm tmp_grep_output.txt
			break
		end
		rm tmp_grep_output.txt
	end
end

echo $module_map > module_map.json
