Pod::Spec.new do |s|
  s.name = 'WalkCompanion'
  s.version = '1.0.0'
  s.summary = 'Ephemeral paired walk handoff'
  s.description = 'WatchConnectivity bridge for Harlem Might'
  s.license = { :type => 'MIT' }
  s.author = 'Harlem Might'
  s.homepage = 'https://github.com/mikevocalz/Harlem-Might'
  s.platforms = { :ios => '16.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
