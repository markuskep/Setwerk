package at.setwerk.app;

public final class MusicQueuePolicyTest {
  private static void same(long actual, long expected) {if(actual!=expected)throw new AssertionError(actual+" != "+expected);}
  public static void main(String[] args) {
    same(MusicQueuePolicy.nextIndex(new long[]{10,20,30},10,null,null),1);
    same(MusicQueuePolicy.nextIndex(new long[]{10,20,30},30,null,null),-1);
    same(MusicQueuePolicy.nextIndex(new long[]{10,20,30},-1,null,null),-1);
    same(MusicQueuePolicy.nextIndex(new long[]{10,20,30},-1,new String[]{"one","two","three"},"two"),2);
    same(MusicQueuePolicy.nextIndex(new long[]{10,20,30},-1,new String[]{"one","one","three"},"one"),-1);
    same(MusicQueuePolicy.nextIndex(new long[]{10,10,30},10,null,null),-1);
    same(MusicQueuePolicy.nextIndex(null,10,null,null),-1);
    same(MusicQueuePolicy.position(60000,1000,1,true,200000),61000);
    same(MusicQueuePolicy.position(60000,1000,1,false,200000),60000);
    same(MusicQueuePolicy.position(199999,1000,1,true,200000),200000);
    same(MusicQueuePolicy.position(-1,0,1,false,0),0);
    same(MusicQueuePolicy.position(60000,1000,2,true,200000),62000);
    System.out.println("12 music queue/position checks passed");
  }
}
