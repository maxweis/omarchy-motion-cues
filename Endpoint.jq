# The menu helper uses jq, which Omarchy already requires. Keep these validation
# cases in sync with Settings.localUrl through tests/test-endpoint.cjs.
$url
| gsub("^\\s+|\\s+$"; "")
| capture("^(http://)?(?<a>[0-9]{1,3})\\.(?<b>[0-9]{1,3})\\.(?<c>[0-9]{1,3})\\.(?<d>[0-9]{1,3})(:(?<port>[0-9]{1,5}))?/?$")
| [.a, .b, .c, .d | tonumber] as $ip
| (if .port then (.port | tonumber) else null end) as $port
| if any($ip[]; . > 255)
     or (($ip[0] == 10 or $ip[0] == 127
          or ($ip[0] == 172 and $ip[1] >= 16 and $ip[1] <= 31)
          or ($ip[0] == 192 and $ip[1] == 168)) | not)
     or ($port != null and ($port < 1 or $port > 65535))
  then error("Use a private IPv4 address and an optional port from 1 to 65535")
  else "http://" + ($ip | map(tostring) | join("."))
       + (if $port then ":" + ($port | tostring) else "" end)
  end
